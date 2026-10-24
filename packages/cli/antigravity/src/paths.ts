import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";

export function resolveHome(filePath: string): string {
  if (filePath.startsWith("~")) {
    return path.join(os.homedir(), filePath.slice(1));
  }
  return filePath;
}

/**
 * Returns the base Antigravity CLI application data directory.
 * Standard location: ~/.gemini/antigravity-cli
 */
export function getAntigravityDataDir(): string {
  if (process.env.ANTIGRAVITY_DATA_DIR) {
    return resolveHome(process.env.ANTIGRAVITY_DATA_DIR);
  }
  if (process.env.ANTIGRAVITY_APP_DATA_DIR) {
    return resolveHome(process.env.ANTIGRAVITY_APP_DATA_DIR);
  }
  return path.join(os.homedir(), ".gemini", "antigravity-cli");
}

/**
 * Returns the brain directory where all session directories are stored.
 */
export function getBrainDir(): string {
  return path.join(getAntigravityDataDir(), "brain");
}

/**
 * Discovers the agy executable binary on the host system.
 */
export function getAgyBinaryPath(): string | null {
  if (process.env.ANTIGRAVITY_BIN && fs.existsSync(process.env.ANTIGRAVITY_BIN)) {
    return process.env.ANTIGRAVITY_BIN;
  }

  // Common Windows locations
  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
    const candidateWin = path.join(localAppData, "agy", "bin", "agy.exe");
    if (fs.existsSync(candidateWin)) {
      return candidateWin;
    }
  }

  // Common Unix locations
  const unixCandidates = [
    path.join(os.homedir(), ".local", "bin", "agy"),
    "/usr/local/bin/agy",
    path.join(os.homedir(), ".agy", "bin", "agy"),
  ];
  for (const candidate of unixCandidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  // Fallback to checking PATH via where/which
  try {
    const checkCmd = process.platform === "win32" ? "where.exe agy" : "which agy";
    const result = execSync(checkCmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    const firstLine = result.split(/\r?\n/)[0]?.trim();
    if (firstLine && fs.existsSync(firstLine)) {
      return firstLine;
    }
  } catch {
    // Not found in PATH
  }

  return "agy"; // Assume it might be in PATH when spawned
}
