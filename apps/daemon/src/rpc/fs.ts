import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export interface DaemonFileNode {
  id: string;
  name: string;
  path: string;
  type: "file" | "directory";
  children?: DaemonFileNode[];
  size?: number;
}

const IGNORED_NAMES = new Set([
  "node_modules",
  ".git",
  ".turbo",
  ".next",
  "dist",
  "build",
  ".gemini",
  "__pycache__",
  ".venv",
]);

export function buildFileTree(dirPath: string, maxDepth = 4, currentDepth = 0): DaemonFileNode[] {
  if (currentDepth >= maxDepth || !fs.existsSync(dirPath)) {
    return [];
  }

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const nodes: DaemonFileNode[] = [];

  for (const entry of entries) {
    if (IGNORED_NAMES.has(entry.name)) continue;

    const fullPath = path.join(dirPath, entry.name);
    const isDir = entry.isDirectory();

    const node: DaemonFileNode = {
      id: fullPath,
      name: entry.name,
      path: fullPath,
      type: isDir ? "directory" : "file",
    };

    if (isDir) {
      node.children = buildFileTree(fullPath, maxDepth, currentDepth + 1);
    } else {
      try {
        node.size = fs.statSync(fullPath).size;
      } catch {
        node.size = 0;
      }
    }

    nodes.push(node);
  }

  // Sort directories first, then files alphabetically
  nodes.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === "directory" ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  return nodes;
}

export function readFileContent(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  return fs.readFileSync(filePath, "utf8");
}

export function writeFileContent(filePath: string, content: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content, "utf8");
}

export interface ListDirectoriesResult {
  currentPath: string;
  parentPath: string | null;
  homePath: string;
  dirs: Array<{ name: string; fullPath: string }>;
}

export function listDirectories(parentPath?: string): ListDirectoriesResult {
  const home = os.homedir();
  const target = parentPath && parentPath.trim() !== "" ? path.resolve(parentPath) : home;
  if (!fs.existsSync(target)) {
    return {
      currentPath: target,
      parentPath: null,
      homePath: home,
      dirs: [],
    };
  }

  const parent = path.dirname(target);
  const hasParent = parent !== target;

  try {
    const entries = fs.readdirSync(target, { withFileTypes: true });
    const dirs = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules")
      .map((e) => ({
        name: e.name,
        fullPath: path.join(target, e.name),
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 100);

    return {
      currentPath: target,
      parentPath: hasParent ? parent : null,
      homePath: home,
      dirs,
    };
  } catch {
    return {
      currentPath: target,
      parentPath: hasParent ? parent : null,
      homePath: home,
      dirs: [],
    };
  }
}
