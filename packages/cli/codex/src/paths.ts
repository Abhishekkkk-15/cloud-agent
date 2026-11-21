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
 * Returns the base Codex CLI home directory ($CODEX_HOME).
 * Default location: ~/.codex
 */
export function getCodexHome(): string {
  if (process.env.CODEX_HOME) {
    return resolveHome(process.env.CODEX_HOME);
  }
  return path.join(os.homedir(), ".codex");
}

/**
 * Returns the path to session_index.jsonl where session listings are maintained.
 */
export function getSessionIndexFile(): string {
  return path.join(getCodexHome(), "session_index.jsonl");
}

/**
 * Returns the directory where full session rollouts (transcripts) are stored.
 */
export function getSessionsDir(): string {
  return path.join(getCodexHome(), "sessions");
}

/**
 * Returns the path to config.toml.
 */
export function getCodexConfigFile(): string {
  return path.join(getCodexHome(), "config.toml");
}

/**
 * Returns the path to models_cache.json.
 */
export function getCodexModelsCacheFile(): string {
  return path.join(getCodexHome(), "models_cache.json");
}

/**
 * Discovers the codex executable binary on the host system.
 */
export function getCodexBinaryPath(): string | null {
  if (process.env.CODEX_BIN && fs.existsSync(process.env.CODEX_BIN)) {
    return process.env.CODEX_BIN;
  }

  // Windows vendor executable candidates
  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
    const appData = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");

    const directCandidates = [
      "C:\\nvm4w\\nodejs\\codex.cmd",
      "C:\\nvm4w\\nodejs\\codex.exe",
      path.join(appData, "npm", "codex.cmd"),
      path.join(appData, "npm", "codex.exe"),
      path.join(localAppData, "Programs", "codex", "bin", "codex.exe"),
    ];

    for (const cand of directCandidates) {
      if (fs.existsSync(cand)) {
        return cand;
      }
    }

    // Try finding via `where.exe codex`
    try {
      const result = execSync("where.exe codex", {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();

      const lines = result.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      // Prefer .cmd or .exe
      const preferred = lines.find((l) => l.endsWith(".exe")) || lines.find((l) => l.endsWith(".cmd")) || lines[0];
      if (preferred && fs.existsSync(preferred)) {
        return preferred;
      }
    } catch {
      // not in PATH
    }
  } else {
    // Unix locations
    const unixCandidates = [
      path.join(os.homedir(), ".local", "bin", "codex"),
      "/usr/local/bin/codex",
      "/usr/bin/codex",
      path.join(os.homedir(), ".nvm", "versions", "node", "bin", "codex"),
    ];
    for (const cand of unixCandidates) {
      if (fs.existsSync(cand)) {
        return cand;
      }
    }

    try {
      const result = execSync("which codex", {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
      if (result && fs.existsSync(result)) {
        return result;
      }
    } catch {
      // not in PATH
    }
  }

  return "codex";
}
