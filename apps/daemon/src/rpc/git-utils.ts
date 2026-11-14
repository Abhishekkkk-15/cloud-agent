import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { getGithubToken, loadConfig } from "../config.js";

export function safeExec(
  cmd: string,
  cwd: string,
  extraEnv?: Record<string, string>
): { output: string; exitCode: number } {
  try {
    const token = getGithubToken();
    const envMerged: Record<string, string | undefined> = {
      ...process.env,
      ...(token ? { GITHUB_TOKEN: token, GH_TOKEN: token } : {}),
      ...(extraEnv || {}),
    };
    const output = execSync(cmd, {
      cwd,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 60000,
      env: envMerged as any,
    });
    return { output: output || "Execution succeeded with 0 exit code", exitCode: 0 };
  } catch (err: any) {
    const stdout = err.stdout?.toString() || "";
    const stderr = err.stderr?.toString() || "";
    return { output: `${stdout}\n${stderr}`.trim() || err.message, exitCode: err.status ?? 1 };
  }
}

export function detectTestCommand(cwd: string): string {
  try {
    const pkgPath = path.join(cwd, "package.json");
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      if (pkg.scripts?.test) {
        if (fs.existsSync(path.join(cwd, "pnpm-lock.yaml"))) return "pnpm test";
        if (fs.existsSync(path.join(cwd, "yarn.lock"))) return "yarn test";
        return "npm test";
      }
      if (pkg.scripts?.typecheck) {
        if (fs.existsSync(path.join(cwd, "pnpm-lock.yaml"))) return "pnpm run typecheck";
        return "npm run typecheck";
      }
    }
    if (fs.existsSync(path.join(cwd, "pytest.ini")) || fs.existsSync(path.join(cwd, "pyproject.toml"))) {
      return "pytest";
    }
    if (fs.existsSync(path.join(cwd, "Cargo.toml"))) {
      return "cargo test";
    }
  } catch {
    // fallback
  }
  return "pnpm test";
}

export function getRepoFullName(cwd: string): string | null {
  const remoteRes = safeExec("git remote get-url origin", cwd);
  if (remoteRes.exitCode !== 0) return null;
  const url = remoteRes.output.trim();
  const match = url.match(/github\.com[/:]([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(\.git)?$/);
  if (match) {
    return `${match[1]}/${match[2]}`;
  }
  return null;
}

export function findMatchingWorkspace(
  repoFullName: string,
  cloneUrl?: string,
  explicitCwd?: string
): string {
  if (explicitCwd && fs.existsSync(explicitCwd)) {
    return explicitCwd;
  }

  const cleanTarget = repoFullName.toLowerCase().replace(/\.git$/, "");
  const cfg = loadConfig();
  const candidates: string[] = [
    process.cwd(),
    ...(cfg.allowedWorkspaces || []),
  ];

  for (const dir of candidates) {
    if (!fs.existsSync(dir)) continue;
    const remote = getRepoFullName(dir);
    if (remote && remote.toLowerCase() === cleanTarget) {
      return dir;
    }
  }

  return explicitCwd || process.cwd();
}

export async function postGithubIssueComment(params: {
  owner: string;
  repo: string;
  issueNumber: number;
  body: string;
  cwd?: string;
}): Promise<boolean> {
  const { owner, repo, issueNumber, body, cwd = process.cwd() } = params;

  // 1. Try gh issue comment
  const escaped = body.replace(/"/g, '\\"');
  const ghRes = safeExec(`gh issue comment ${issueNumber} --body "${escaped}" || true`, cwd);
  if (
    ghRes.exitCode === 0 &&
    !ghRes.output.toLowerCase().includes("error") &&
    !ghRes.output.toLowerCase().includes("not logged in")
  ) {
    return true;
  }

  // 2. Fallback to GitHub REST API
  const token = getGithubToken();
  if (!token) return false;

  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "Cloud-Agent-Daemon",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ body }),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

export async function addGithubReaction(params: {
  owner: string;
  repo: string;
  issueNumber: number;
  content: "+1" | "-1" | "laugh" | "confused" | "heart" | "hooray" | "rocket" | "eyes";
}): Promise<boolean> {
  const { owner, repo, issueNumber, content } = params;
  const token = getGithubToken();
  if (!token) return false;

  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/reactions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "Cloud-Agent-Daemon",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content }),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

export async function createOrUpdatePullRequest(params: {
  owner: string;
  repo: string;
  headBranch: string;
  baseBranch: string;
  title: string;
  body: string;
  cwd?: string;
}): Promise<{ prUrl?: string; prNumber?: number }> {
  const { owner, repo, headBranch, baseBranch, title, body, cwd = process.cwd() } = params;

  // 1. Try gh pr create
  const prRes = safeExec(
    `gh pr create --title "${title.replace(/"/g, '\\"')}" --body "${body.replace(/"/g, '\\"')}" --head ${headBranch} --base ${baseBranch} || true`,
    cwd
  );

  const ghUrlMatch = prRes.output.match(/https:\/\/github\.com\/[^\s]+\/pull\/(\d+)/);
  if (ghUrlMatch) {
    return {
      prUrl: ghUrlMatch[0],
      prNumber: parseInt(ghUrlMatch[1], 10),
    };
  }

  // 2. Fallback to GitHub REST API
  const token = getGithubToken();
  if (!token) return {};

  try {
    const apiRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "Cloud-Agent-Daemon",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        body,
        head: headBranch,
        base: baseBranch,
      }),
    });

    if (apiRes.ok) {
      const data = (await apiRes.json()) as any;
      return {
        prUrl: data.html_url,
        prNumber: data.number,
      };
    }
  } catch (err) {
    console.warn("[git-utils] REST API PR creation failed:", err);
  }

  return {};
}
