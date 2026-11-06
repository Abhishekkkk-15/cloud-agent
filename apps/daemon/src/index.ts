#!/usr/bin/env node
import os from "node:os";
import { loadConfig, saveConfig, getConfigPath } from "./config.js";
import { registry } from "./registry.js";
import { GatewayConnection } from "./connection.js";

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

    case "config":
      console.log(`Config path: ${getConfigPath()}\n`);
      console.log(JSON.stringify(loadConfig(), null, 2));
      break;

    case "help":
    case "--help":
    case "-h":
      console.log(`Usage: cloud-agent-daemon [command] [options] (or: ca [command])

Commands:
  start          Start daemon and connect to Cloud Gateway (default)
  pair           Pair machine with mobile app (renders QR code in terminal)
  check          Check installed CLI adapters (antigravity, etc.)
  run <prompt>   Execute a live prompt via the CLI adapter
  sessions [ws]  List agent sessions from local storage
  config         Display daemon configuration
  help           Show this help message

Options for 'start' / 'pair':
  --token, -t <token>     Machine pairing token (optional for pair)
  --gateway, -g <url>     Gateway WebSocket URL (default: wss://gateway.cloud-agent.abhishekkkk.in/daemon/ws)
  --name, -n <name>       Custom machine name override
`);
      break;

    default:
      console.error(`Unknown command: ${command}`);
      console.log(`Run 'cloud-agent-daemon help' for available commands.`);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
