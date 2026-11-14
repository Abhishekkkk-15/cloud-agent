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

export function writeFileContent(
  filePath: string,
  content: string,
  encoding: "utf8" | "base64" = "utf8"
): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (encoding === "base64") {
    fs.writeFileSync(filePath, Buffer.from(content, "base64"));
  } else {
    fs.writeFileSync(filePath, content, "utf8");
  }
}

export interface SavedAttachmentResult {
  ok: boolean;
  filename: string;
  hostPath: string;
  mimeType: string;
  size: number;
}

/**
 * Saves a file upload attachment to the session media directory or a target directory.
 */
export function saveSessionAttachment(
  sessionId: string,
  filename: string,
  base64Data: string,
  mimeType?: string,
  targetDirectory?: string
): SavedAttachmentResult {
  // Sanitize filename to prevent directory traversal
  const cleanFilename = path.basename(filename).replace(/[\\/:*?"<>|]/g, "_");

  let targetDir: string;
  if (targetDirectory && targetDirectory.trim()) {
    targetDir = path.resolve(targetDirectory.trim());
  } else {
    // Default session attachments directory in user's home .gemini / .cloud-agent directory
    const home = os.homedir();
    targetDir = path.join(home, ".gemini", "antigravity-cli", "brain", sessionId, ".user_uploaded");
  }

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const finalPath = path.join(targetDir, cleanFilename);
  const buffer = Buffer.from(base64Data, "base64");
  fs.writeFileSync(finalPath, buffer);

  return {
    ok: true,
    filename: cleanFilename,
    hostPath: finalPath,
    mimeType: mimeType || "application/octet-stream",
    size: buffer.length,
  };
}

export interface ListDirectoriesResult {
  currentPath: string;
  parentPath: string | null;
  homePath: string;
  dirs: Array<{ name: string; fullPath: string }>;
  drives: string[];
}

export function getAvailableDrives(): string[] {
  if (process.platform === "win32") {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((l) => `${l}:\\`);
    return letters.filter((d) => {
      try {
        return fs.existsSync(d);
      } catch {
        return false;
      }
    });
  } else if (process.platform === "darwin") {
    const volumes = "/Volumes";
    const drives = ["/"];
    try {
      if (fs.existsSync(volumes)) {
        const entries = fs.readdirSync(volumes);
        for (const e of entries) {
          drives.push(path.join(volumes, e));
        }
      }
    } catch {
      // ignore
    }
    return drives;
  } else {
    // Linux
    const drives = ["/"];
    try {
      for (const dir of ["/media", "/mnt"]) {
        if (fs.existsSync(dir)) {
          const entries = fs.readdirSync(dir);
          for (const e of entries) {
            drives.push(path.join(dir, e));
          }
        }
      }
    } catch {
      // ignore
    }
    return drives;
  }
}

export function listDirectories(parentPath?: string): ListDirectoriesResult {
  const home = os.homedir();
  const drives = getAvailableDrives();

  let target: string;
  if (!parentPath || parentPath.trim() === "") {
    // Prefer process.cwd() if valid, otherwise home directory
    target = fs.existsSync(process.cwd()) ? process.cwd() : home;
  } else {
    const clean = parentPath.trim();
    // Normalize Windows drive letters (e.g. "D:" or "D:\" -> "D:\")
    if (process.platform === "win32" && /^[a-zA-Z]:?\\?$/.test(clean)) {
      target = clean.slice(0, 1).toUpperCase() + ":\\";
    } else {
      target = path.resolve(clean);
    }
  }

  if (!fs.existsSync(target)) {
    return {
      currentPath: target,
      parentPath: null,
      homePath: home,
      dirs: [],
      drives,
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
      drives,
    };
  } catch {
    return {
      currentPath: target,
      parentPath: hasParent ? parent : null,
      homePath: home,
      dirs: [],
      drives,
    };
  }
}

export interface CreateDirectoryResult {
  ok: boolean;
  fullPath: string;
  name: string;
}

/**
 * Creates a new directory on the host filesystem directly from remote client requests.
 */
export function createDirectory(parentPath: string, folderName?: string): CreateDirectoryResult {
  const cleanParent = parentPath.trim();
  const cleanName = (folderName || "").trim();

  if (!cleanParent) {
    throw new Error("Missing parent directory path");
  }

  let targetPath: string;
  let finalName: string;

  if (cleanName) {
    // Disallow directory traversal or prohibited filesystem characters in the folder name
    if (/[\\/:*?"<>|]/.test(cleanName) || cleanName.includes("..")) {
      throw new Error(`Invalid folder name "${cleanName}". Folder names cannot contain slashes, colons, or "..".`);
    }
    targetPath = path.join(cleanParent, cleanName);
    finalName = cleanName;
  } else {
    targetPath = path.resolve(cleanParent);
    finalName = path.basename(targetPath) || targetPath;
  }

  if (fs.existsSync(targetPath)) {
    throw new Error(`A folder or file named "${finalName}" already exists at this location.`);
  }

  fs.mkdirSync(targetPath, { recursive: true });

  return {
    ok: true,
    fullPath: targetPath,
    name: finalName,
  };
}
