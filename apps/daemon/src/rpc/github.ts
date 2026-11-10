import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { getGithubToken, setGithubToken, clearGithubToken } from "../config.js";

export interface GithubStatusResult {
  authenticated: boolean;
  source: "token" | "cli" | "none";
  username?: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
  scopes?: string;
  error?: string;
  message?: string;
  gitUserName?: string;
  gitUserEmail?: string;
  gitCredentialHelper?: string;
  hasGhCli?: boolean;
  ghCliAuthenticated?: boolean;
}

export interface GithubConfigParams {
  token: string;
  userName?: string;
  email?: string;
  configureGitCredentials?: boolean;
}

export interface GithubTestResult {
  success: boolean;
  githubApiOk: boolean;
  username?: string;
  scopes?: string;
  rateLimitRemaining?: string;
  gitInstalled: boolean;
  gitVersion?: string;
  gitUserName?: string;
  gitUserEmail?: string;
  credentialHelper?: string;
  message: string;
  error?: string;
}

/**
 * Read global git configuration key safely
 */
export function getGitConfig(key: string): string | undefined {
  try {
    const val = execSync(`git config --global ${key}`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 3000,
    }).trim();
    return val.length > 0 ? val : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Write global git configuration key safely
 */
export function setGitConfig(key: string, value: string): void {
  const sanitized = value.replace(/"/g, '\\"');
  execSync(`git config --global ${key} "${sanitized}"`, {
    stdio: ["pipe", "pipe", "pipe"],
    timeout: 3000,
  });
}

/**
 * Check if GitHub CLI (`gh`) is installed and available in PATH
 */
export function hasGhCli(): boolean {
  try {
    execSync("gh --version", {
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 2000,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Configures git credentials on the host machine using gh CLI and standard Git credential helper
 */
export function configureHostGitCredentials(username: string, token: string): { success: boolean; method: string } {
  // 1. If gh CLI is present, authenticate gh and wire git credential helper
  if (hasGhCli()) {
    try {
      execSync(`gh auth login --with-token`, {
        input: token,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 8000,
      });
      execSync(`gh auth setup-git`, {
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 5000,
      });
      return { success: true, method: "gh-cli" };
    } catch (err) {
      console.warn("[Daemon/GitHub] gh auth setup-git warning:", err);
    }
  }

  // 2. Standard Git credential helper fallback
  try {
    const currentHelper = getGitConfig("credential.helper");
    if (!currentHelper) {
      setGitConfig("credential.helper", "store");
    }

    // Approve credential via standard git credential protocol
    const credentialData = `protocol=https\nhost=github.com\nusername=${username}\npassword=${token}\n\n`;
    execSync(`git credential approve`, {
      input: credentialData,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 5000,
    });

    // Also write ~/.git-credentials with restrictive permissions (0600)
    try {
      const credsPath = path.join(os.homedir(), ".git-credentials");
      const entry = `https://${encodeURIComponent(username)}:${encodeURIComponent(token)}@github.com`;
      let existing = "";
      if (fs.existsSync(credsPath)) {
        existing = fs.readFileSync(credsPath, "utf8");
      }
      const lines = existing
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !l.includes("@github.com"));
      lines.push(entry);
      fs.writeFileSync(credsPath, lines.join("\n") + "\n", { encoding: "utf8", mode: 0o600 });
    } catch {
      // ignore file write errors if git credential helper handled it
    }

    return { success: true, method: "git-credential-store" };
  } catch (err) {
    console.error("[Daemon/GitHub] Failed to configure git credentials:", err);
    return { success: false, method: "error" };
  }
}

/**
 * Clears host credentials from Git credential store and gh CLI
 */
export function removeHostGitCredentials(): void {
  try {
    const input = `protocol=https\nhost=github.com\n\n`;
    execSync(`git credential reject`, {
      input,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 5000,
    });
  } catch {}

  try {
    const credsPath = path.join(os.homedir(), ".git-credentials");
    if (fs.existsSync(credsPath)) {
      const existing = fs.readFileSync(credsPath, "utf8");
      const filtered = existing
        .split("\n")
        .map((l) => l.trim())
        .filter((line) => line.length > 0 && !line.includes("@github.com"))
        .join("\n");
      fs.writeFileSync(credsPath, filtered ? filtered + "\n" : "", { encoding: "utf8", mode: 0o600 });
    }
  } catch {}

  if (hasGhCli()) {
    try {
      execSync(`gh auth logout --hostname github.com`, {
        input: "y\n",
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 5000,
      });
    } catch {}
  }
}

export async function handleGithubStatus(): Promise<GithubStatusResult> {
  const token = getGithubToken();
  const gitUserName = getGitConfig("user.name");
  const gitUserEmail = getGitConfig("user.email");
  const gitCredentialHelper = getGitConfig("credential.helper");
  const ghCliAvailable = hasGhCli();

  // 1. Check Personal Access Token
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
        const data = (await res.json()) as any;
        const scopes = res.headers.get("x-oauth-scopes") || undefined;
        return {
          authenticated: true,
          source: "token",
          username: data.login,
          name: data.name,
          email: data.email,
          avatarUrl: data.avatar_url,
          scopes,
          gitUserName,
          gitUserEmail,
          gitCredentialHelper,
          hasGhCli: ghCliAvailable,
        };
      } else {
        return {
          authenticated: false,
          source: "token",
          error: `Personal Access Token returned HTTP ${res.status}: ${res.statusText}`,
          gitUserName,
          gitUserEmail,
          gitCredentialHelper,
          hasGhCli: ghCliAvailable,
        };
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        authenticated: false,
        source: "token",
        error: `Failed to verify token with GitHub API: ${msg}`,
        gitUserName,
        gitUserEmail,
        gitCredentialHelper,
        hasGhCli: ghCliAvailable,
      };
    }
  }

  // 2. Check GitHub CLI (`gh auth status`)
  if (ghCliAvailable) {
    try {
      const output = execSync("gh auth status 2>&1 || true", {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 5000,
      });

      const match =
        output.match(/account\s+([A-Za-z0-9_-]+)/i) ||
        output.match(/Logged in to [^\s]+ as ([A-Za-z0-9_-]+)/i);
      if (match && match[1]) {
        return {
          authenticated: true,
          source: "cli",
          username: match[1],
          gitUserName,
          gitUserEmail,
          gitCredentialHelper,
          hasGhCli: true,
          ghCliAuthenticated: true,
        };
      }
    } catch {
      // gh CLI not available or errored
    }
  }

  return {
    authenticated: false,
    source: "none",
    message: "No GitHub Personal Access Token or CLI login configured on host.",
    gitUserName,
    gitUserEmail,
    gitCredentialHelper,
    hasGhCli: ghCliAvailable,
  };
}

export async function handleGithubConfigure(params: GithubConfigParams): Promise<{
  success: boolean;
  username?: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
  scopes?: string;
  gitUserName?: string;
  gitUserEmail?: string;
  error?: string;
}> {
  const cleanToken = params.token?.trim();
  if (!cleanToken) {
    return { success: false, error: "GitHub token cannot be empty." };
  }

  try {
    // 1. Verify token with GitHub API
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
        error: `GitHub rejected token with HTTP ${res.status}. Ensure token has 'repo' scope.`,
      };
    }

    const data = (await res.json()) as any;
    const scopes = res.headers.get("x-oauth-scopes") || undefined;

    // 2. Determine author name and email
    const effectiveUserName = (params.userName?.trim() || data.name || data.login || "").trim();
    const effectiveEmail = (params.email?.trim() || data.email || "").trim();

    // 3. Configure Git user.name and user.email globally on the machine
    if (effectiveUserName) {
      try {
        setGitConfig("user.name", effectiveUserName);
      } catch (err: any) {
        console.warn("[Daemon/GitHub] Failed to set git user.name:", err);
      }
    }

    if (effectiveEmail) {
      try {
        setGitConfig("user.email", effectiveEmail);
      } catch (err: any) {
        console.warn("[Daemon/GitHub] Failed to set git user.email:", err);
      }
    }

    // 4. Configure Git credentials for HTTPS push/clone
    if (params.configureGitCredentials !== false) {
      configureHostGitCredentials(data.login, cleanToken);
    }

    // 5. Save token in daemon configuration
    setGithubToken(cleanToken);
    process.env.GITHUB_TOKEN = cleanToken;
    process.env.GH_TOKEN = cleanToken;

    return {
      success: true,
      username: data.login,
      name: data.name,
      email: data.email,
      avatarUrl: data.avatar_url,
      scopes,
      gitUserName: getGitConfig("user.name"),
      gitUserEmail: getGitConfig("user.email"),
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Network error verifying token: ${msg}` };
  }
}

export async function handleGithubTestConnection(): Promise<GithubTestResult> {
  const token = getGithubToken();
  const gitUserName = getGitConfig("user.name");
  const gitUserEmail = getGitConfig("user.email");
  const credentialHelper = getGitConfig("credential.helper");

  let gitInstalled = false;
  let gitVersion: string | undefined;

  try {
    gitVersion = execSync("git --version", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 3000,
    }).trim();
    gitInstalled = true;
  } catch {}

  if (!token) {
    return {
      success: false,
      githubApiOk: false,
      gitInstalled,
      gitVersion,
      gitUserName,
      gitUserEmail,
      credentialHelper,
      message: "No GitHub token configured on host machine.",
      error: "Missing token",
    };
  }

  try {
    const res = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": "Cloud-Agent-Daemon",
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!res.ok) {
      return {
        success: false,
        githubApiOk: false,
        gitInstalled,
        gitVersion,
        gitUserName,
        gitUserEmail,
        credentialHelper,
        message: `GitHub API returned HTTP ${res.status}. Token may be expired or revoked.`,
        error: `HTTP ${res.status}`,
      };
    }

    const data = (await res.json()) as any;
    const scopes = res.headers.get("x-oauth-scopes") || "none";
    const rateLimitRemaining = res.headers.get("x-ratelimit-remaining") || undefined;

    return {
      success: true,
      githubApiOk: true,
      username: data.login,
      scopes,
      rateLimitRemaining,
      gitInstalled,
      gitVersion,
      gitUserName,
      gitUserEmail,
      credentialHelper,
      message: `Verified GitHub connection as @${data.login}. Git author: "${gitUserName || "Not set"}" <${gitUserEmail || "Not set"}>.`,
    };
  } catch (err: any) {
    return {
      success: false,
      githubApiOk: false,
      gitInstalled,
      gitVersion,
      gitUserName,
      gitUserEmail,
      credentialHelper,
      message: `Failed to reach GitHub API: ${err?.message || String(err)}`,
      error: err?.message || String(err),
    };
  }
}

/**
 * Backward compatible wrapper for handleGithubConfigure
 */
export async function handleGithubSetToken(token: string): Promise<{
  success: boolean;
  username?: string;
  name?: string;
  avatarUrl?: string;
  error?: string;
}> {
  return handleGithubConfigure({ token, configureGitCredentials: true });
}

export async function handleGithubRemoveToken(): Promise<{ success: boolean }> {
  clearGithubToken();
  delete process.env.GITHUB_TOKEN;
  delete process.env.GH_TOKEN;
  removeHostGitCredentials();
  return { success: true };
}
