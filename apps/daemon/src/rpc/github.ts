import { execSync } from "node:child_process";
import { getGithubToken, setGithubToken, clearGithubToken } from "../config.js";

export interface GithubStatusResult {
  authenticated: boolean;
  source: "token" | "cli" | "none";
  username?: string;
  name?: string;
  avatarUrl?: string;
  scopes?: string;
  error?: string;
  message?: string;
}

export async function handleGithubStatus(): Promise<GithubStatusResult> {
  const token = getGithubToken();

  // 1. Check Personal Access Token (Option B)
  if (token) {
    try {
      const res = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${token}`,
          "User-Agent": "Cloud-Agent-Daemon",
          Accept: "application/vnd.github.v3+json",
        },
      });

      if (res.ok) {
        const data = await res.json() as any;
        const scopes = res.headers.get("x-oauth-scopes") || undefined;
        return {
          authenticated: true,
          source: "token",
          username: data.login,
          name: data.name,
          avatarUrl: data.avatar_url,
          scopes,
        };
      } else {
        return {
          authenticated: false,
          source: "token",
          error: `Personal Access Token returned HTTP ${res.status}: ${res.statusText}`,
        };
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        authenticated: false,
        source: "token",
        error: `Failed to verify token with GitHub API: ${msg}`,
      };
    }
  }

  // 2. Check GitHub CLI (`gh auth status`)
  try {
    const output = execSync("gh auth status 2>&1 || true", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 5000,
    });

    const match = output.match(/account\s+([A-Za-z0-9_-]+)/i) || output.match(/Logged in to [^\s]+ as ([A-Za-z0-9_-]+)/i);
    if (match && match[1]) {
      return {
        authenticated: true,
        source: "cli",
        username: match[1],
      };
    }
  } catch {
    // gh CLI not available or errored
  }

  return {
    authenticated: false,
    source: "none",
    message: "No GitHub Personal Access Token (Option B) or CLI login configured.",
  };
}

export async function handleGithubSetToken(token: string): Promise<{
  success: boolean;
  username?: string;
  name?: string;
  avatarUrl?: string;
  error?: string;
}> {
  const cleanToken = token.trim();
  if (!cleanToken) {
    return { success: false, error: "GitHub token cannot be empty." };
  }

  try {
    const res = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${cleanToken}`,
        "User-Agent": "Cloud-Agent-Daemon",
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!res.ok) {
      return {
        success: false,
        error: `GitHub rejected token with HTTP ${res.status}. Ensure the token is valid and active.`,
      };
    }

    const data = await res.json() as any;
    setGithubToken(cleanToken);

    return {
      success: true,
      username: data.login,
      name: data.name,
      avatarUrl: data.avatar_url,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Network error verifying token: ${msg}` };
  }
}

export async function handleGithubRemoveToken(): Promise<{ success: boolean }> {
  clearGithubToken();
  return { success: true };
}
