import type { IncomingMessage, ServerResponse } from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function findScriptFile(filename: string): string | null {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(currentDir, "../../../scripts", filename),
    path.resolve(process.cwd(), "scripts", filename),
    path.resolve(process.cwd(), "../scripts", filename),
    path.resolve(process.cwd(), "../../scripts", filename),
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return c;
    }
  }
  return null;
}

const GITHUB_RAW_BASE = "https://raw.githubusercontent.com/Abhishekkkk-15/cloud-agent/main/scripts";

async function getScriptContent(filename: string): Promise<string | null> {
  // 1. Try fetching freshest version from GitHub (3s timeout) to ensure callers always get latest installer
  try {
    const res = await fetch(`${GITHUB_RAW_BASE}/${filename}`, {
      headers: { "User-Agent": "Cloud-Agent-Gateway/1.0" },
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      return await res.text();
    }
  } catch {
    // Network delay or offline, fallback to local disk
  }

  // 2. Fallback to local file on disk
  const scriptPath = findScriptFile(filename);
  if (scriptPath && fs.existsSync(scriptPath)) {
    return fs.readFileSync(scriptPath, "utf8");
  }

  return null;
}

export async function handleInstallerRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL
): Promise<boolean> {
  const pathname = url.pathname.toLowerCase();

  // 1. Bash installer (Linux / macOS): /install.sh or /install
  if (req.method === "GET" && (pathname === "/install.sh" || pathname === "/install")) {
    const content = await getScriptContent("install.sh");
    if (content) {
      res.writeHead(200, {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Access-Control-Allow-Origin": "*",
      });
      res.end(content);
      return true;
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("install.sh not found on server");
    return true;
  }

  // 2. PowerShell installer (Windows): /install.ps1
  if (req.method === "GET" && pathname === "/install.ps1") {
    const content = await getScriptContent("install.ps1");
    if (content) {
      res.writeHead(200, {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Access-Control-Allow-Origin": "*",
      });
      res.end(content);
      return true;
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("install.ps1 not found on server");
    return true;
  }

  return false;
}
