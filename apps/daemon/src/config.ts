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
  githubToken?: string;
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

export const DEFAULT_GATEWAY_WS_URL = "wss://cloud-agent-3q6w.onrender.com/daemon/ws";

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
    gatewayUrl: process.env.CLOUD_AGENT_GATEWAY_URL || DEFAULT_GATEWAY_WS_URL,
    token: process.env.CLOUD_AGENT_TOKEN || "",
    allowedWorkspaces: [process.cwd()],
    defaultCli: "antigravity",
    heartbeatIntervalMs: 15000,
  };

  saveConfig(defaults);
  return defaults;
}

export function getGithubToken(): string | undefined {
  const envToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (envToken && envToken.trim().length > 0) return envToken.trim();
  const cfg = loadConfig();
  return cfg.githubToken?.trim() || undefined;
}

export function setGithubToken(token: string): void {
  const cfg = loadConfig();
  cfg.githubToken = token.trim();
  saveConfig(cfg);
}

export function clearGithubToken(): void {
  const cfg = loadConfig();
  delete cfg.githubToken;
  saveConfig(cfg);
}
