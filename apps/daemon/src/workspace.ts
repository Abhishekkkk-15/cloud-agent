import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { loadConfig, saveConfig } from "./config.js";

function getGitBranch(dirPath: string): string | null {
  try {
    const gitDir = path.join(dirPath, ".git");
    if (!fs.existsSync(gitDir)) return null;
    const branch = execSync("git rev-parse --abbrev-ref HEAD", {
      cwd: dirPath,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return branch || null;
  } catch {
    return null;
  }
}

export function addWorkspace(targetPath?: string): void {
  const rawPath = targetPath || process.cwd();
  const absPath = path.resolve(process.cwd(), rawPath);

  if (!fs.existsSync(absPath)) {
    console.error(`\x1b[31mError: Path does not exist:\x1b[0m ${absPath}`);
    process.exit(1);
  }

  const stat = fs.statSync(absPath);
  if (!stat.isDirectory()) {
    console.error(`\x1b[31mError: Path is not a directory:\x1b[0m ${absPath}`);
    process.exit(1);
  }

  const config = loadConfig();
  const workspaces = config.allowedWorkspaces || [];

  const normalized = path.normalize(absPath);
  const exists = workspaces.some((w) => path.normalize(w).toLowerCase() === normalized.toLowerCase());

  if (exists) {
    console.log(`\x1b[33mℹ Workspace already registered:\x1b[0m ${normalized}`);
    return;
  }

  workspaces.push(normalized);
  config.allowedWorkspaces = workspaces;
  saveConfig(config);

  const gitBranch = getGitBranch(normalized);
  const name = path.basename(normalized) || normalized;

  console.log(`\n\x1b[1m\x1b[32m✔ Workspace registered successfully!\x1b[0m`);
  console.log(`  Name        : \x1b[1m\x1b[37m${name}\x1b[0m`);
  console.log(`  Path        : \x1b[36m${normalized}\x1b[0m`);
  if (gitBranch) {
    console.log(`  Git Branch  : \x1b[35m${gitBranch}\x1b[0m`);
  }
  console.log(`  Mobile App  : \x1b[90mImmediately available in your Mobile Workspace Tree\x1b[0m\n`);
}

export function listWorkspaces(): void {
  const config = loadConfig();
  const workspaces = config.allowedWorkspaces || [];

  console.log(`\n\x1b[1m\x1b[36mRegistered Workspaces (${workspaces.length}):\x1b[0m\n`);

  if (workspaces.length === 0) {
    console.log(`  \x1b[90mNo workspaces registered yet.\x1b[0m`);
    console.log(`  Add one with: \x1b[32mca workspace add <path>\x1b[0m (or 'ca workspace add .')\n`);
    return;
  }

  workspaces.forEach((wsPath, index) => {
    const exists = fs.existsSync(wsPath);
    const gitBranch = exists ? getGitBranch(wsPath) : null;
    const name = path.basename(wsPath) || wsPath;
    const statusTag = exists ? "\x1b[32m[Valid]\x1b[0m" : "\x1b[31m[Missing]\x1b[0m";
    const gitTag = gitBranch ? `\x1b[35m(git: ${gitBranch})\x1b[0m` : "\x1b[90m(no git)\x1b[0m";

    console.log(`  ${index + 1}. \x1b[1m\x1b[37m${name}\x1b[0m ${statusTag} ${gitTag}`);
    console.log(`     \x1b[90m${wsPath}\x1b[0m\n`);
  });
}

export function removeWorkspace(targetPath?: string): void {
  if (!targetPath) {
    console.error(`\x1b[31mError: Please specify the path to remove.\x1b[0m`);
    console.log(`Usage: ca workspace remove <path>`);
    process.exit(1);
  }

  const absPath = path.resolve(process.cwd(), targetPath);
  const normalized = path.normalize(absPath).toLowerCase();

  const config = loadConfig();
  const workspaces = config.allowedWorkspaces || [];

  const filtered = workspaces.filter((w) => path.normalize(w).toLowerCase() !== normalized);

  if (filtered.length === workspaces.length) {
    console.log(`\x1b[33mWorkspace was not found in registered list:\x1b[0m ${absPath}`);
    return;
  }

  config.allowedWorkspaces = filtered;
  saveConfig(config);

  console.log(`\x1b[32m✔ Workspace removed:\x1b[0m ${absPath}`);
}
