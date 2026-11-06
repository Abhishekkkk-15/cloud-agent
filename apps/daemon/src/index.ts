#!/usr/bin/env node
import os from "node:os";
import { loadConfig, saveConfig, getConfigPath } from "./config.js";
import { registry } from "./registry.js";
import { GatewayConnection } from "./connection.js";
import { initDaemonLogger, tailLogs } from "./logger.js";
import { addWorkspace, listWorkspaces, removeWorkspace } from "./workspace.js";
import {
  installService,
  startService,
  stopService,
  restartService,
  statusService,
  uninstallService,
} from "./service.js";
import { exposePort } from "./tunnel.js";
import { showDaemonStatus, runDoctor } from "./doctor.js";

async function printBanner() {
  console.log(`
┌───────────────────────────────────────────────┐
│              Cloud Agent Daemon               │
│        Zero-DB Pluggable Coding Agent         │
└───────────────────────────────────────────────┘
`);
}

async function checkAdapters() {
  console.log(`Checking registered CLI adapters on this host...\n`);
  const availabilities = await registry.checkAll();

  for (const [id, info] of Object.entries(availabilities)) {
    if (info.available) {
      console.log(`  [OK]   ${id.padEnd(14)} Version: ${info.version ?? "installed"} (${info.binaryPath})`);
    } else {
      console.log(`  [FAIL] ${id.padEnd(14)} Not available: ${info.error}`);
    }
  }
  console.log();
}

async function listSessions(workspaceFilter?: string) {
  const adapter = registry.get();
  console.log(`Listing sessions for adapter: ${adapter.displayName} (${adapter.id})\n`);
  const result = await adapter.listSessions({ workspaceFilter, limit: 10 });

  if (result.items.length === 0) {
    console.log(`No sessions found.`);
    return;
  }

  console.log(`Found ${result.total} sessions (showing latest ${result.items.length}):\n`);
  for (const s of result.items) {
    console.log(`• [${s.id}] ${s.title}`);
    console.log(`  Updated: ${s.updatedAt} | Messages: ${s.messageCount}`);
    if (s.workspacePath) {
      console.log(`  Workspace: ${s.workspacePath}`);
    }
    console.log();
  }
}

async function runPrompt(prompt: string, sessionId?: string) {
  const adapter = registry.get();
  console.log(`Executing prompt via adapter: ${adapter.displayName} (${adapter.id})\n`);
  const stream = adapter.run({
    prompt,
    sessionId,
    cwd: process.cwd(),
    dangerouslySkipPermissions: true,
  });

  for await (const event of stream) {
    if (event.type === "text_chunk") {
      process.stdout.write((event.data as any).text);
    } else if (event.type === "thought") {
      process.stdout.write(`\x1b[35m${(event.data as any).thought}\x1b[0m`);
    } else if (event.type === "status") {
      const data = event.data as any;
      console.log(`\x1b[36m[Status] ${data.status}${data.message ? `: ${data.message}` : ""}\x1b[0m`);
    } else if (event.type === "error") {
      console.error(`\x1b[31m[Error] ${(event.data as any).error}\x1b[0m`);
    } else if (event.type === "tool_call") {
      console.log(`\x1b[33m[Tool Call] ${(event.data as any).name}\x1b[0m`, (event.data as any).arguments);
    }
  }
  console.log();
}

function parseCliFlags(args: string[]): {
  command: string;
  flags: Record<string, string>;
  positionals: string[];
} {
  let command = "start";
  const flags: Record<string, string> = {};
  const positionals: string[] = [];

  let i = 0;
  if (args.length > 0 && !args[0].startsWith("-")) {
    command = args[0];
    i = 1;
  }

  while (i < args.length) {
    const arg = args[i];
    if (arg === "--token" || arg === "-t") {
      flags.token = args[i + 1] || "";
      i += 2;
    } else if (arg.startsWith("--token=")) {
      flags.token = arg.slice(8);
      i++;
    } else if (arg === "--gateway" || arg === "-g") {
      flags.gateway = args[i + 1] || "";
      i += 2;
    } else if (arg.startsWith("--gateway=")) {
      flags.gateway = arg.slice(10);
      i++;
    } else if (arg === "--name" || arg === "-n") {
      flags.name = args[i + 1] || "";
      i += 2;
    } else if (arg.startsWith("--name=")) {
      flags.name = arg.slice(7);
      i++;
    } else if (arg === "--follow" || arg === "-f") {
      flags.follow = "true";
      i++;
    } else if (arg === "--lines") {
      flags.lines = args[i + 1] || "50";
      i += 2;
    } else if (arg.startsWith("--lines=")) {
      flags.lines = arg.slice(8);
      i++;
    } else if (arg === "--port" || arg === "-p") {
      flags.port = args[i + 1] || "";
      i += 2;
    } else if (arg.startsWith("--port=")) {
      flags.port = arg.slice(7);
      i++;
    } else if (arg.startsWith("-")) {
      i++;
    } else {
      positionals.push(arg);
      i++;
    }
  }

  return { command, flags, positionals };
}

async function pairMachine(flags: Record<string, string>) {
  const config = loadConfig();
  const token = flags.token;
  const name = flags.name || config.machineName || os.hostname();
  const gateway = flags.gateway || config.gatewayUrl;

  console.log(`\x1b[1m\x1b[36mPairing Machine:\x1b[0m ${name} (${config.machineId})`);
  console.log(`\x1b[90mGateway: ${gateway}\x1b[0m\n`);

  // If token was explicitly supplied, display pre-authenticated QR code (backward compatibility)
  if (token) {
    const payload = `ca_pair://connect?token=${encodeURIComponent(token)}&name=${encodeURIComponent(name)}&machineId=${encodeURIComponent(config.machineId)}&gateway=${encodeURIComponent(gateway)}`;
    console.log(`Scan this QR code with the Cloud Agent mobile app to pair instantly:\n`);
    try {
      const qrcodeModule = await import("qrcode-terminal");
      const qrcode = (qrcodeModule as any).default || qrcodeModule;
      if (typeof qrcode.generate === "function") {
        qrcode.generate(payload, { small: true }, (qr: string) => {
          console.log(qr);
        });
      }
    } catch (err) {
      console.warn(`Failed to render terminal QR code:`, err);
    }
    console.log(`\x1b[90mOr copy the start command:\x1b[0m`);
    console.log(`\x1b[32mpnpm --filter @cloud-agent/daemon dev start --token "${token}"\x1b[0m\n`);
    return;
  }

  // --- Reverse Daemon-First Pairing Flow (Scan from Mobile & Done) ---
  const httpGateway = (flags.gateway || config.gatewayUrl || "https://gateway.cloud-agent.abhishekkkk.in")
    .replace(/^wss:\/\//i, "https://")
    .replace(/^ws:\/\//i, "http://")
    .replace(/\/daemon\/ws\/?$/, "");

  console.log(`\x1b[36mRequesting pairing session from Gateway (${httpGateway})...\x1b[0m`);

  try {
    const initRes = await fetch(`${httpGateway}/api/machines/pair/init`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        machineName: name,
        platform: os.platform(),
        arch: os.arch(),
      }),
    });

    if (!initRes.ok) {
      throw new Error(`Gateway returned HTTP ${initRes.status}: ${await initRes.text()}`);
    }

    const initData = (await initRes.json()) as {
      pairId: string;
      pairCode: string;
      secret: string;
      qrPayload: string;
      expiresAt: number;
      machineName: string;
    };

    console.log(`\n\x1b[1m\x1b[32m════════════════════════════════════════════════════════════════\x1b[0m`);
    console.log(`\x1b[1m  Cloud Agent — Instant Node Pairing\x1b[0m`);
    console.log(`  Machine Name : \x1b[1m\x1b[37m${initData.machineName}\x1b[0m`);
    console.log(`  Pairing Code : \x1b[1m\x1b[33m${initData.pairCode}\x1b[0m  (valid for 10 minutes)`);
    console.log(`\x1b[1m\x1b[32m════════════════════════════════════════════════════════════════\x1b[0m\n`);

    console.log(`\x1b[1mScan this QR code from your Cloud Agent mobile app to pair instantly:\x1b[0m\n`);
    try {
      const qrcodeModule = await import("qrcode-terminal");
      const qrcode = (qrcodeModule as any).default || qrcodeModule;
      if (typeof qrcode.generate === "function") {
        qrcode.generate(initData.qrPayload, { small: true }, (qr: string) => {
          console.log(qr);
        });
      }
    } catch (err) {
      console.warn(`Could not render QR code in terminal:`, err);
    }

    console.log(`\n\x1b[90mOr enter this pairing code in Mobile -> Pair Machine:\x1b[0m \x1b[1m\x1b[33m${initData.pairCode}\x1b[0m\n`);
    process.stdout.write(`\x1b[36mWaiting for mobile authorization...\x1b[0m `);

    const startTime = Date.now();
    const timeoutMs = 10 * 60 * 1000;

    while (Date.now() - startTime < timeoutMs) {
      await new Promise((r) => setTimeout(r, 1500));
      try {
        const pollRes = await fetch(
          `${httpGateway}/api/machines/pair/poll?id=${encodeURIComponent(initData.pairId)}&secret=${encodeURIComponent(initData.secret)}`
        );
        if (pollRes.ok) {
          const pollData = (await pollRes.json()) as any;
          if (pollData.status === "claimed" && pollData.token) {
            console.log(`\n\n\x1b[1m\x1b[32m✔ Machine successfully authorized by mobile client!\x1b[0m`);
            config.token = pollData.token;
            if (pollData.machineId) config.machineId = pollData.machineId;
            if (pollData.name) config.machineName = pollData.name;
            saveConfig(config);
            console.log(`\x1b[32m✔ Credentials saved to: ${getConfigPath()}\x1b[0m`);
            console.log(`\x1b[36m✔ Connecting to Cloud Agent Gateway...\x1b[0m\n`);
            await startDaemon(flags);
            return;
          }
        }
      } catch {
        // Transient network delay, keep polling
      }
      process.stdout.write(`\x1b[33m.\x1b[0m`);
    }

    console.log(`\n\x1b[31m[!] Pairing session timed out. Run 'ca pair' to try again.\x1b[0m\n`);
  } catch (err) {
    console.error(`\x1b[31m[Error] Failed to initialize pairing session with Gateway:\x1b[0m`, (err as Error).message);
    console.log(`\nFallback: Generate a token in Mobile -> Pair Node -> Terminal Command, then run:`);
    console.log(`cloud-agent-daemon start --token "<ca_mach_...>"\n`);
  }
}

async function startDaemon(flags: Record<string, string>) {
  initDaemonLogger();
  const config = loadConfig();

  // Apply CLI flag overrides
  let changed = false;
  if (flags.token) {
    config.token = flags.token;
    changed = true;
  }
  if (flags.gateway) {
    config.gatewayUrl = flags.gateway;
    changed = true;
  } else if (config.gatewayUrl.includes(":8000/daemon/ws")) {
    // Auto-migrate legacy port 8000 to gateway port 8080
    config.gatewayUrl = config.gatewayUrl.replace(":8000/daemon/ws", ":8080/daemon/ws");
    changed = true;
  }
  if (flags.name) {
    config.machineName = flags.name;
    changed = true;
  }

  if (changed) {
    saveConfig(config);
  }

  console.log(`Configuration loaded from: ${getConfigPath()}`);
  console.log(`Machine ID   : ${config.machineId}`);
  console.log(`Machine Name : ${config.machineName}`);
  console.log(`Gateway URL  : ${config.gatewayUrl}`);
  console.log(`Token Prefix : ${config.token ? config.token.slice(0, 16) + "..." : "(none - run with --token <token>)"}`);
  console.log();

  if (!config.token) {
    console.warn(`[!] No machine pairing token configured.`);
    console.warn(`    Generate a token in the Cloud Agent Dashboard -> 'Connect VPS'`);
    console.warn(`    Then run: cloud-agent-daemon start --token "<your-token>"\n`);
  }

  await checkAdapters();

  const connection = new GatewayConnection(config);
  connection.start();

  process.on("SIGINT", () => {
    console.log("\n[Daemon] Stopping daemon...");
    connection.stop();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    console.log("\n[Daemon] Terminating daemon...");
    connection.stop();
    process.exit(0);
  });
}

async function main() {
  const rawArgs = process.argv.slice(2);
  const { command, flags, positionals } = parseCliFlags(rawArgs);

  await printBanner();

  switch (command) {
    case "start":
      await startDaemon(flags);
      break;

    case "pair":
      await pairMachine(flags);
      break;

    case "check":
      await checkAdapters();
      break;

    case "run":
      if (!positionals[0]) {
        console.error("Error: Please provide a prompt. Example: cloud-agent-daemon run 'hello'");
        process.exit(1);
      }
      await runPrompt(positionals[0], positionals[1]);
      break;

    case "sessions":
      await listSessions(positionals[0]);
      break;

    case "workspace":
    case "workspaces": {
      const sub = positionals[0]?.toLowerCase();
      if (sub === "add") {
        addWorkspace(positionals[1]);
      } else if (sub === "remove" || sub === "rm" || sub === "del") {
        removeWorkspace(positionals[1]);
      } else {
        listWorkspaces();
      }
      break;
    }

    case "service": {
      const sub = positionals[0]?.toLowerCase() || "status";
      if (sub === "install") {
        await installService();
      } else if (sub === "start") {
        await startService();
      } else if (sub === "stop") {
        await stopService();
      } else if (sub === "restart") {
        await restartService();
      } else if (sub === "uninstall") {
        await uninstallService();
      } else {
        await statusService();
      }
      break;
    }

    case "logs":
    case "log": {
      await tailLogs({
        lines: flags.lines ? parseInt(flags.lines, 10) : 50,
        follow: flags.follow === "true",
      });
      break;
    }

    case "expose":
    case "tunnel": {
      const port = positionals[0] || flags.port;
      if (!port) {
        console.error(`\x1b[31mError: Please specify the local port to expose.\x1b[0m`);
        console.log(`Example: ca expose 3000 (or 'ca expose 5173')`);
        process.exit(1);
      }
      await exposePort(port, { name: flags.name, gateway: flags.gateway });
      break;
    }

    case "status":
      await showDaemonStatus();
      break;

    case "doctor":
      await runDoctor();
      break;

    case "config":
      console.log(`Config path: ${getConfigPath()}\n`);
      console.log(JSON.stringify(loadConfig(), null, 2));
      break;

    case "help":
    case "--help":
    case "-h":
      console.log(`Usage: cloud-agent-daemon [command] [options] (or: ca [command])

Core Commands:
  start                     Start daemon in foreground (connects to Gateway)
  pair                      Pair machine with mobile app (terminal QR & code)
  status                    Display connection & machine status summary
  doctor                    Run diagnostic check on runtime, adapters & network

Workspace Commands (P1):
  workspace list            List all registered workspaces and git status
  workspace add [path]      Register a workspace (defaults to current dir)
  workspace remove <path>   Unlink a workspace from mobile fleet list

Background Service Commands (P1):
  service install           Register daemon as systemd, launchd, or background service
  service start             Launch daemon in background
  service stop              Stop background daemon process
  service restart           Restart background daemon process
  service status            Show background service running state and PID
  service uninstall         Unregister system service

Log Streaming Commands (P2):
  logs [-f] [--lines=N]     Inspect and follow live daemon output (~/.cloud-agent/daemon.log)

Port Forwarding & Web Preview (P3):
  expose <port>             Expose local dev server (port 3000, 5173, etc.) with preview URL & QR

Diagnostic & Execution:
  check                     Check installed CLI adapters (antigravity, etc.)
  run <prompt>              Execute a live prompt via the CLI adapter
  sessions [ws]             List agent sessions from local storage
  config                    Display raw daemon configuration JSON
  help                      Show this help message

Options:
  --token, -t <token>       Machine pairing token
  --gateway, -g <url>       Gateway WebSocket URL
  --name, -n <name>         Custom machine name override
  --follow, -f              Follow log stream in real time ('ca logs -f')
  --lines <num>             Number of lines to read ('ca logs --lines=100')
`);
      break;

    default:
      console.error(`Unknown command: ${command}`);
      console.log(`Run 'cloud-agent-daemon help' for available commands.`);
      process.exit(1);
  }

  // Ensure one-shot queries exit immediately without lingering event handles
  const longRunningCommands = ["start", "pair", "expose", "tunnel"];
  if (!longRunningCommands.includes(command) && !flags.follow && !flags.f) {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
