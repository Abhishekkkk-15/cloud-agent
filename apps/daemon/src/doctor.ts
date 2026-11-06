import os from "node:os";
import fs from "node:fs";
import { execSync } from "node:child_process";
import { loadConfig, getConfigPath } from "./config.js";
import { registry } from "./registry.js";
import { getLogFilePath } from "./logger.js";

export async function showDaemonStatus(): Promise<void> {
  const config = loadConfig();
  const workspaces = config.allowedWorkspaces || [];
  const logPath = getLogFilePath();

  console.log(`\n\x1b[1m\x1b[36mCloud Agent Daemon Status\x1b[0m\n`);
  console.log(`  Machine Name   : \x1b[1m\x1b[37m${config.machineName}\x1b[0m`);
  console.log(`  Machine ID     : \x1b[90m${config.machineId}\x1b[0m`);
  console.log(`  Platform       : ${process.platform} (${process.arch})`);
  console.log(`  Node.js        : ${process.version}`);
  console.log(`  Gateway URL    : \x1b[36m${config.gatewayUrl}\x1b[0m`);
  console.log(`  Token Status   : ${config.token ? "\x1b[32m✔ Configured\x1b[0m" : "\x1b[33m⚠️ Not set (run 'ca pair' to link)\x1b[0m"}`);
  console.log(`  Workspaces     : \x1b[35m${workspaces.length} registered\x1b[0m ('ca workspace list')`);
  console.log(`  Config File    : \x1b[90m${getConfigPath()}\x1b[0m`);
  console.log(`  Log File       : \x1b[90m${logPath}\x1b[0m ('ca logs -f')\n`);
}

export async function runDoctor(): Promise<void> {
  console.log(`\n\x1b[1m\x1b[36mCloud Agent Doctor — Environment & Connectivity Diagnostics\x1b[0m\n`);

  let issuesFound = 0;

  // 1. Node.js Version Check
  const nodeMajor = parseInt(process.version.replace(/^v/, "").split(".")[0], 10);
  if (nodeMajor >= 20) {
    console.log(`  \x1b[32m✔\x1b[0m Node.js Runtime     : \x1b[1m${process.version}\x1b[0m (supported)`);
  } else {
    console.log(`  \x1b[31m✖\x1b[0m Node.js Runtime     : \x1b[1m${process.version}\x1b[0m (Requires Node >= 20)`);
    issuesFound++;
  }

  // 2. Git Check
  try {
    const gitVer = execSync("git --version", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    console.log(`  \x1b[32m✔\x1b[0m Git Version         : \x1b[1m${gitVer}\x1b[0m`);
  } catch {
    console.log(`  \x1b[33m⚠️\x1b[0m Git Version         : Not found in PATH`);
    issuesFound++;
  }

  // 3. Adapter Checks
  const adapters = registry.list();
  const adapterNames = adapters.map((a) => a.id).join(", ");
  const availability = await registry.checkAll();
  console.log(`  \x1b[32m✔\x1b[0m Registered Adapters : \x1b[1m${adapterNames}\x1b[0m`);

  let hasAvailableAdapter = false;
  for (const [name, avail] of Object.entries(availability)) {
    if (avail.available) {
      console.log(`    • \x1b[32m✔\x1b[0m ${name} : Available ${avail.version ? `(${avail.version})` : ""}`);
      hasAvailableAdapter = true;
    } else {
      console.log(`    • \x1b[33m⚠️\x1b[0m ${name} : ${avail.error || "Not detected in PATH"}`);
    }
  }

  if (!hasAvailableAdapter) {
    issuesFound++;
  }

  // 4. Config & Auth Check
  const config = loadConfig();
  if (config.token && config.token.trim().length > 0) {
    console.log(`  \x1b[32m✔\x1b[0m Pairing Token       : \x1b[32mPresent\x1b[0m (${config.token.slice(0, 12)}...)`);
  } else {
    console.log(`  \x1b[33m⚠️\x1b[0m Pairing Token       : \x1b[33mMissing\x1b[0m (run 'ca pair' to link with mobile)`);
    issuesFound++;
  }

  // 5. Gateway Connectivity Check
  const httpGateway = (config.gatewayUrl || "https://gateway.cloud-agent.abhishekkkk.in")
    .replace(/^wss:\/\//i, "https://")
    .replace(/^ws:\/\//i, "http://")
    .replace(/\/daemon\/ws\/?$/, "");

  try {
    const startTime = Date.now();
    const res = await fetch(`${httpGateway}/health`, { signal: AbortSignal.timeout(6000) });
    const latency = Date.now() - startTime;
    if (res.ok) {
      console.log(`  \x1b[32m✔\x1b[0m Gateway Healthcheck : \x1b[32mReachable\x1b[0m (${latency}ms at ${httpGateway})`);
    } else {
      console.log(`  \x1b[33m⚠️\x1b[0m Gateway Healthcheck : HTTP ${res.status} from ${httpGateway}`);
      issuesFound++;
    }
  } catch (err: any) {
    console.log(`  \x1b[31m✖\x1b[0m Gateway Healthcheck : \x1b[31mUnreachable\x1b[0m (${err.message})`);
    issuesFound++;
  }

  // 6. Disk & Permissions Check
  try {
    const configPath = getConfigPath();
    fs.accessSync(configPath, fs.constants.R_OK | fs.constants.W_OK);
    console.log(`  \x1b[32m✔\x1b[0m Disk Permissions    : Read/Write verified for ~/.cloud-agent/`);
  } catch {
    console.log(`  \x1b[31m✖\x1b[0m Disk Permissions    : Cannot write to ~/.cloud-agent/`);
    issuesFound++;
  }

  console.log(`\n────────────────────────────────────────────────────────────────`);
  if (issuesFound === 0) {
    console.log(`\x1b[1m\x1b[32mEverything looks good! Cloud Agent Daemon is fully ready to run.\x1b[0m\n`);
  } else {
    console.log(`\x1b[1m\x1b[33mDiagnostic found ${issuesFound} item(s) to verify.\x1b[0m\n`);
  }
}
