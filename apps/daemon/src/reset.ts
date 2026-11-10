import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { stopService, uninstallService } from "./service.js";
import { getConfigPath } from "./config.js";

export interface ResetOptions {
  purge?: boolean;
}

export async function resetConfiguration(options: ResetOptions = {}): Promise<void> {
  const isPurge = options.purge === true;

  console.log(`\n\x1b[1m\x1b[36m${isPurge ? "Purging Cloud Agent completely..." : "Resetting Cloud Agent configuration & pairing..."}\x1b[0m\n`);

  // 1. Stop background service & processes
  try {
    await stopService();
  } catch (err: any) {
    // Ignore error
  }

  // 2. Uninstall background service from systemd/launchd
  try {
    await uninstallService();
  } catch (err: any) {
    // Ignore error
  }

  // 3. Remove configuration and state files
  const caDir = path.join(os.homedir(), ".cloud-agent");
  const pidFile = path.join(caDir, "daemon.pid");
  const logFile = path.join(caDir, "daemon.log");
  const configFile = getConfigPath();

  if (fs.existsSync(pidFile)) {
    try {
      fs.unlinkSync(pidFile);
    } catch {}
  }

  if (fs.existsSync(configFile)) {
    try {
      fs.unlinkSync(configFile);
      console.log(`  \x1b[32m✔ Removed configuration file:\x1b[0m ${configFile}`);
    } catch (err: any) {
      console.warn(`  Could not remove ${configFile}: ${err.message}`);
    }
  }

  if (fs.existsSync(logFile)) {
    try {
      fs.unlinkSync(logFile);
      console.log(`  \x1b[32m✔ Cleared daemon log:\x1b[0m ${logFile}`);
    } catch {}
  }

  if (isPurge) {
    // 4. Remove executable symlinks
    const symlinks = [
      "/usr/local/bin/ca",
      "/usr/local/bin/cloud-agent-daemon",
      path.join(os.homedir(), ".local", "bin", "ca"),
      path.join(os.homedir(), ".local", "bin", "cloud-agent-daemon"),
    ];

    for (const link of symlinks) {
      try {
        if (fs.existsSync(link)) {
          fs.unlinkSync(link);
          console.log(`  \x1b[32m✔ Removed executable link:\x1b[0m ${link}`);
        }
      } catch {}
    }

    // 5. Clean shell rc files (.bashrc, .zshrc, .profile)
    const shellRcFiles = [
      path.join(os.homedir(), ".bashrc"),
      path.join(os.homedir(), ".zshrc"),
      path.join(os.homedir(), ".profile"),
    ];

    for (const rc of shellRcFiles) {
      try {
        if (fs.existsSync(rc)) {
          const content = fs.readFileSync(rc, "utf8");
          if (content.includes(".cloud-agent/bin")) {
            const cleaned = content
              .split("\n")
              .filter((line) => !line.includes(".cloud-agent/bin"))
              .join("\n");
            fs.writeFileSync(rc, cleaned, "utf8");
            console.log(`  \x1b[32m✔ Cleaned PATH export from:\x1b[0m ${rc}`);
          }
        }
      } catch {}
    }

    // 6. Remove entire ~/.cloud-agent directory (runtime, bin, config, logs)
    try {
      if (fs.existsSync(caDir)) {
        fs.rmSync(caDir, { recursive: true, force: true });
        console.log(`  \x1b[32m✔ Removed Cloud Agent home directory:\x1b[0m ${caDir}`);
      }
    } catch (err: any) {
      console.warn(`  Could not remove ${caDir}: ${err.message}`);
    }

    console.log(`\n\x1b[1m\x1b[32m════════════════════════════════════════════════════════════════\x1b[0m`);
    console.log(`\x1b[1m\x1b[32m✔ Cloud Agent has been completely removed from this system.\x1b[0m`);
    console.log(`\x1b[1m\x1b[32m════════════════════════════════════════════════════════════════\x1b[0m\n`);
  } else {
    console.log(`\n\x1b[1m\x1b[32m════════════════════════════════════════════════════════════════\x1b[0m`);
    console.log(`\x1b[1m\x1b[32m✔ All Cloud Agent configuration & pairing has been reset!\x1b[0m`);
    console.log(`  The background service was stopped and machine credentials removed.`);
    console.log(`  To link this machine again with your mobile app, run:`);
    console.log(`    \x1b[36m\x1b[1mca pair\x1b[0m`);
    console.log(`\x1b[1m\x1b[32m════════════════════════════════════════════════════════════════\x1b[0m\n`);
  }
}
