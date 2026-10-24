import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

export interface DaemonConfig {
  machineId: string;
  machineName: string;
  gatewayUrl: string;
  token: string;
  allowedWorkspaces?: string[];
  defaultCli?: string;
  heartbeatIntervalMs?: number;
}

export function getConfigPath(): string {
  const dir = path.join(os.homedir(), ".cloud-agent");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return path.join(dir, "daemon.json");
}

export function loadConfig(): DaemonConfig {
  const filePath = getConfigPath();
  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, "utf8");
      return JSON.parse(raw);
    } catch {
      // If corrupted, fallback to default
    }
  }
  return ensureDefaultConfig();
}

export function saveConfig(config: DaemonConfig): void {
  const filePath = getConfigPath();
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2), "utf8");
}

export function ensureDefaultConfig(): DaemonConfig {
  const filePath = getConfigPath();
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch {
      // Re-create default
    }
  }

  const defaults: DaemonConfig = {
    machineId: crypto.randomUUID(),
    machineName: os.hostname(),
    gatewayUrl: process.env.CLOUD_AGENT_GATEWAY_URL || "ws://localhost:8080/daemon/ws",
    token: process.env.CLOUD_AGENT_TOKEN || "",
    allowedWorkspaces: [process.cwd()],
    defaultCli: "antigravity",
    heartbeatIntervalMs: 15000,
  };

  saveConfig(defaults);
  return defaults;
}
