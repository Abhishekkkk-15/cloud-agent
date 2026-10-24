#!/usr/bin/env node
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

async function startDaemon() {
  const config = loadConfig();
  console.log(`Configuration loaded from: ${getConfigPath()}`);
  console.log(`Machine ID   : ${config.machineId}`);
  console.log(`Machine Name : ${config.machineName}`);
  console.log(`Gateway URL  : ${config.gatewayUrl}`);
  console.log();

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
  const args = process.argv.slice(2);
  const command = args[0] || "start";

  await printBanner();

  switch (command) {
    case "start":
      await startDaemon();
      break;

    case "check":
      await checkAdapters();
      break;

    case "run":
      if (!args[1]) {
        console.error("Error: Please provide a prompt. Example: cloud-agent-daemon run 'hello'");
        process.exit(1);
      }
      await runPrompt(args[1], args[2]);
      break;

    case "sessions":
      await listSessions(args[1]);
      break;

    case "config":
      console.log(`Config path: ${getConfigPath()}\n`);
      console.log(JSON.stringify(loadConfig(), null, 2));
      break;

    case "help":
    case "--help":
    case "-h":
      console.log(`Usage: cloud-agent-daemon [command]

Commands:
  start          Start daemon and connect to Cloud Gateway (default)
  check          Check installed CLI adapters (antigravity, etc.)
  run <prompt>   Execute a live prompt via the CLI adapter
  sessions [ws]  List agent sessions from local storage
  config         Display daemon configuration
  help           Show this help message
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
