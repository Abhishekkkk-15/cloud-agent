import fs from "node:fs";
import path from "node:path";

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
