import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { getLogFilePath } from "./logger.js";

const PID_FILE = path.join(os.homedir(), ".cloud-agent", "daemon.pid");

function getDaemonEntryScript(): string {
  // Try resolving current compiled index.js or dist/index.js
  const dirname = path.dirname(fileURLToPath(import.meta.url));
  const candidateJs = path.join(dirname, "index.js");
  if (fs.existsSync(candidateJs)) {
    return candidateJs;
  }
  const candidateTs = path.join(dirname, "index.ts");
  if (fs.existsSync(candidateTs)) {
    return candidateTs;
  }
  return path.resolve(process.cwd(), "dist", "index.js");
}

function getCaBinaryPath(): string {
  const customBin = path.join(os.homedir(), ".cloud-agent", "bin", process.platform === "win32" ? "ca.cmd" : "ca");
  if (fs.existsSync(customBin)) {
    return customBin;
  }
  return "";
}

function getExecutionCommand(): { cmd: string; args: string[]; displayCmd: string } {
  const caBin = getCaBinaryPath();
  if (caBin) {
    return { cmd: caBin, args: ["start"], displayCmd: `"${caBin}" start` };
  }

  const scriptPath = getDaemonEntryScript();
  const nodePath = process.execPath;
  if (scriptPath.endsWith(".js")) {
    return { cmd: nodePath, args: [scriptPath, "start"], displayCmd: `"${nodePath}" "${scriptPath}" start` };
  }

  // Look for tsx runner in monorepo runtime root or daemon node_modules
  const candidateTsx1 = path.resolve(path.dirname(scriptPath), "..", "..", "..", "node_modules", "tsx", "dist", "cli.mjs");
  const candidateTsx2 = path.resolve(path.dirname(scriptPath), "..", "node_modules", "tsx", "dist", "cli.mjs");
  const tsxCli = fs.existsSync(candidateTsx1) ? candidateTsx1 : fs.existsSync(candidateTsx2) ? candidateTsx2 : "";

  if (tsxCli) {
    return { cmd: nodePath, args: [tsxCli, scriptPath, "start"], displayCmd: `"${nodePath}" "${tsxCli}" "${scriptPath}" start` };
  }

  return { cmd: nodePath, args: [scriptPath, "start"], displayCmd: `"${nodePath}" "${scriptPath}" start` };
}

function getStoredPid(): number | null {
  try {
    if (fs.existsSync(PID_FILE)) {
      const raw = fs.readFileSync(PID_FILE, "utf8").trim();
      const pid = parseInt(raw, 10);
      if (!isNaN(pid) && pid > 0) {
        return pid;
      }
    }
  } catch {}
  return null;
}

function savePid(pid: number): void {
  const dir = path.dirname(PID_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(PID_FILE, String(pid), "utf8");
}

function removePid(): void {
  try {
    if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE);
  } catch {}
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// --- Platform Specific Service Setup ---

function getSystemdPath(): string {
  return path.join(os.homedir(), ".config", "systemd", "user", "cloud-agent.service");
}

function getLaunchdPath(): string {
  return path.join(os.homedir(), "Library", "LaunchAgents", "com.cloudagent.daemon.plist");
}

export async function installService(): Promise<void> {
  const execCmd = getExecutionCommand();
  const logPath = getLogFilePath();

  console.log(`\x1b[36mInstalling Cloud Agent background service...\x1b[0m`);
  console.log(`  Execution Command : ${execCmd.displayCmd}`);
  console.log(`  Log File Path     : ${logPath}\n`);

  if (process.platform === "linux") {
    const serviceFile = getSystemdPath();
    const serviceDir = path.dirname(serviceFile);
    if (!fs.existsSync(serviceDir)) {
      fs.mkdirSync(serviceDir, { recursive: true });
    }

    const unitContent = `[Unit]
Description=Cloud Agent Daemon
After=network.target

[Service]
Type=simple
ExecStart=${execCmd.displayCmd}
Restart=always
RestartSec=5
WorkingDirectory=${os.homedir()}
Environment=NODE_ENV=production
StandardOutput=append:${logPath}
StandardError=append:${logPath}

[Install]
WantedBy=default.target
`;

    fs.writeFileSync(serviceFile, unitContent, "utf8");
    try {
      execSync("systemctl --user daemon-reload", { stdio: "ignore" });
      execSync("systemctl --user enable cloud-agent.service", { stdio: "ignore" });
      console.log(`\x1b[32m✔ Systemd user unit installed and enabled:\x1b[0m ${serviceFile}`);
      console.log(`  Run \x1b[1mca service start\x1b[0m to launch the background service.`);
    } catch (e: any) {
      console.log(`\x1b[33mUnit file created at ${serviceFile}\x1b[0m`);
      console.log(`To enable: systemctl --user daemon-reload && systemctl --user enable cloud-agent.service`);
    }
  } else if (process.platform === "darwin") {
    const plistFile = getLaunchdPath();
    const plistDir = path.dirname(plistFile);
    if (!fs.existsSync(plistDir)) {
      fs.mkdirSync(plistDir, { recursive: true });
    }

    const argsXml = [execCmd.cmd, ...execCmd.args]
      .map((a) => `        <string>${a}</string>`)
      .join("\n");

    const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.cloudagent.daemon</string>
    <key>ProgramArguments</key>
    <array>
${argsXml}
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${logPath}</string>
    <key>StandardErrorPath</key>
    <string>${logPath}</string>
</dict>
</plist>
`;

    fs.writeFileSync(plistFile, plistContent, "utf8");
    try {
      execSync(`launchctl load "${plistFile}"`, { stdio: "ignore" });
      console.log(`\x1b[32m✔ macOS LaunchAgent installed and loaded:\x1b[0m ${plistFile}`);
    } catch {
      console.log(`\x1b[33mLaunchAgent plist written to:\x1b[0m ${plistFile}`);
    }
  } else if (process.platform === "win32") {
    try {
      const taskName = "CloudAgentDaemon";
      const escapedCmd = execCmd.displayCmd.replace(/"/g, '\\"');
      const cmd = `schtasks /create /tn "${taskName}" /tr "${escapedCmd}" /sc onlogon /f`;
      execSync(cmd, { stdio: "ignore" });
      console.log(`\x1b[32m✔ Windows Scheduled Task '${taskName}' registered for auto-startup on login.\x1b[0m`);
    } catch {
      console.log(`\x1b[33mBackground PID management will be used on Windows.\x1b[0m`);
    }
  }

  console.log(`\nNext step: Run \x1b[32mca service start\x1b[0m to begin background execution.`);
}

export async function startService(): Promise<void> {
  // Check if already running
  const currentPid = getStoredPid();
  if (currentPid && isPidAlive(currentPid)) {
    console.log(`\x1b[33mCloud Agent Daemon is already running (PID: ${currentPid})\x1b[0m`);
    console.log(`Run 'ca service status' or 'ca logs -f' to inspect.`);
    return;
  }

  if (process.platform === "linux") {
    try {
      execSync("systemctl --user start cloud-agent.service", { stdio: "inherit" });
      console.log(`\x1b[32m✔ Systemd background service started.\x1b[0m`);
      return;
    } catch {
      // Fallback to detached process
    }
  } else if (process.platform === "darwin") {
    try {
      execSync("launchctl start com.cloudagent.daemon", { stdio: "inherit" });
      console.log(`\x1b[32m✔ macOS launchd background service started.\x1b[0m`);
      return;
    } catch {
      // Fallback to detached process
    }
  }

  // Universal Detached Process Launcher
  const execCmd = getExecutionCommand();
  const logPath = getLogFilePath();
  const outLog = fs.openSync(logPath, "a");

  const child = spawn(execCmd.cmd, execCmd.args, {
    detached: true,
    stdio: ["ignore", outLog, outLog],
    cwd: os.homedir(),
    env: { ...process.env, NODE_ENV: "production" },
  });

  if (child.pid) {
    savePid(child.pid);
    child.unref();
    console.log(`\n\x1b[1m\x1b[32m✔ Cloud Agent Daemon started in background!\x1b[0m`);
    console.log(`  PID      : \x1b[1m\x1b[37m${child.pid}\x1b[0m`);
    console.log(`  Log File : \x1b[36m${logPath}\x1b[0m`);
    console.log(`  Tail Logs: \x1b[35mca logs -f\x1b[0m`);
    console.log(`  Stop     : \x1b[90mca service stop\x1b[0m\n`);
  } else {
    console.error(`\x1b[31mFailed to spawn background daemon process.\x1b[0m`);
  }
}

export async function stopService(): Promise<void> {
  let stopped = false;

  if (process.platform === "linux") {
    try {
      execSync("systemctl --user stop cloud-agent.service", { stdio: "ignore" });
      stopped = true;
    } catch {}
  } else if (process.platform === "darwin") {
    try {
      execSync("launchctl stop com.cloudagent.daemon", { stdio: "ignore" });
      stopped = true;
    } catch {}
  }

  const pid = getStoredPid();
  if (pid) {
    if (isPidAlive(pid)) {
      try {
        process.kill(pid, "SIGTERM");
        // Give 1 second, then force kill if needed
        setTimeout(() => {
          if (isPidAlive(pid)) {
            try { process.kill(pid, "SIGKILL"); } catch {}
          }
        }, 1200);
        stopped = true;
      } catch (err: any) {
        console.warn(`Could not signal process ${pid}: ${err.message}`);
      }
    }
    removePid();
  }

  if (stopped) {
    console.log(`\x1b[32m✔ Cloud Agent background service stopped.\x1b[0m`);
  } else {
    console.log(`\x1b[33mNo active background daemon process found.\x1b[0m`);
  }
}

export async function restartService(): Promise<void> {
  console.log(`Restarting Cloud Agent background service...`);
  await stopService();
  await new Promise((r) => setTimeout(r, 1000));
  await startService();
}

export async function statusService(): Promise<void> {
  console.log(`\n\x1b[1m\x1b[36mCloud Agent Daemon Service Status:\x1b[0m\n`);

  if (process.platform === "linux") {
    try {
      const out = execSync("systemctl --user status cloud-agent.service", { encoding: "utf8" });
      console.log(out);
      return;
    } catch (e: any) {
      if (e.stdout) {
        console.log(e.stdout);
        return;
      }
    }
  }

  const pid = getStoredPid();
  if (pid && isPidAlive(pid)) {
    console.log(`  State    : \x1b[1m\x1b[32mRunning (Active)\x1b[0m`);
    console.log(`  PID      : \x1b[1m\x1b[37m${pid}\x1b[0m`);
    console.log(`  Platform : ${process.platform} (${process.arch})`);
    console.log(`  Logs     : ca logs -f\n`);
  } else {
    if (pid) removePid();
    console.log(`  State    : \x1b[31mStopped (Inactive)\x1b[0m`);
    console.log(`  Start it : \x1b[32mca service start\x1b[0m (or 'ca start' for foreground)\n`);
  }
}

export async function uninstallService(): Promise<void> {
  console.log(`Uninstalling Cloud Agent service...`);
  await stopService();

  if (process.platform === "linux") {
    const file = getSystemdPath();
    if (fs.existsSync(file)) {
      try {
        execSync("systemctl --user disable cloud-agent.service", { stdio: "ignore" });
        fs.unlinkSync(file);
        execSync("systemctl --user daemon-reload", { stdio: "ignore" });
        console.log(`\x1b[32m✔ Systemd unit removed.\x1b[0m`);
      } catch {}
    }
  } else if (process.platform === "darwin") {
    const file = getLaunchdPath();
    if (fs.existsSync(file)) {
      try {
        execSync(`launchctl unload "${file}"`, { stdio: "ignore" });
        fs.unlinkSync(file);
        console.log(`\x1b[32m✔ LaunchAgent removed.\x1b[0m`);
      } catch {}
    }
  } else if (process.platform === "win32") {
    try {
      execSync("schtasks /delete /tn \"CloudAgentDaemon\" /f", { stdio: "ignore" });
      console.log(`\x1b[32m✔ Windows Scheduled Task deleted.\x1b[0m`);
    } catch {}
  }

  removePid();
  console.log(`\x1b[32m✔ Cloud Agent service uninstalled.\x1b[0m`);
}
