import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { registry } from "../registry.js";
import { handleSessionsList, handleSessionsGet, handleMessagesGet } from "./session.js";
import { handleAgentRun, handleAgentCancel, handleRespondPermission } from "./run.js";
import { buildFileTree, readFileContent, writeFileContent, listDirectories } from "./fs.js";
import type { CliEvent } from "@cloud-agent/cli-interface";

export interface RpcRequest {
  id: string;
  method: string;
  params?: Record<string, any>;
}

export interface RpcResponse {
  id: string;
  result?: unknown;
  error?: string;
  stream?: boolean;
  done?: boolean;
}

export type StreamCallback = (chunk: {
  id: string;
  stream: true;
  event: CliEvent;
  done?: boolean;
}) => void;

function getSystemTelemetry() {
  const cpus = os.cpus();
  let totalTicks = 0;
  let idleTicks = 0;
  for (const cpu of cpus) {
    for (const t of Object.values(cpu.times)) {
      totalTicks += t;
    }
    idleTicks += cpu.times.idle;
  }
  const cpuPercent = totalTicks > 0 ? Math.round(((totalTicks - idleTicks) / totalTicks) * 100) : 0;

  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  let diskInfo: { totalGb: number; usedGb: number; freeGb: number; percent: number } | null = null;
  try {
    if (typeof (fs as any).statfsSync === "function") {
      const rootPath = process.platform === "win32" ? "C:\\" : "/";
      const stats = (fs as any).statfsSync(rootPath);
      if (stats && stats.blocks) {
        const totalBytes = Number(stats.bsize) * Number(stats.blocks);
        const freeBytes = Number(stats.bsize) * Number(stats.bfree);
        const usedBytes = totalBytes - freeBytes;
        diskInfo = {
          totalGb: Number((totalBytes / (1024 ** 3)).toFixed(1)),
          usedGb: Number((usedBytes / (1024 ** 3)).toFixed(1)),
          freeGb: Number((freeBytes / (1024 ** 3)).toFixed(1)),
          percent: Math.round((usedBytes / totalBytes) * 100),
        };
      }
    }
  } catch {
    // ignore statfs failures on exotic platforms
  }

  return {
    cpu: {
      percent: cpuPercent,
      cores: cpus.length,
      model: cpus[0]?.model || "Multi-Core CPU",
      speedMhz: cpus[0]?.speed || 0,
    },
    ram: {
      totalGb: Number((totalMem / (1024 ** 3)).toFixed(1)),
      usedGb: Number((usedMem / (1024 ** 3)).toFixed(1)),
      freeGb: Number((freeMem / (1024 ** 3)).toFixed(1)),
      percent: Math.round((usedMem / totalMem) * 100),
    },
    disk: diskInfo,
    loadAvg: os.loadavg(),
  };
}

export class RpcDispatcher {
  async handle(req: RpcRequest, onStream?: StreamCallback): Promise<RpcResponse> {
    const params = req.params || {};

    try {
      switch (req.method) {
        case "ping":
          return { id: req.id, result: { pong: true, timestamp: new Date().toISOString() } };

        case "daemon.status": {
          const avail = await registry.checkAll();
          const telemetry = getSystemTelemetry();
          return {
            id: req.id,
            result: {
              hostname: os.hostname(),
              platform: process.platform,
              arch: process.arch,
              uptime: os.uptime(),
              pid: process.pid,
              nodeVersion: process.version,
              telemetry,
              adapters: registry.list(),
              availability: avail,
            },
          };
        }

        case "sessions.list": {
          const result = await handleSessionsList({
            cli: params.cli,
            workspaceFilter: params.workspaceFilter,
          });
          return { id: req.id, result };
        }

        case "sessions.get": {
          if (!params.sessionId) {
            throw new Error("Missing sessionId param");
          }
          const result = await handleSessionsGet({
            cli: params.cli,
            sessionId: params.sessionId,
            limit: params.limit,
            offset: params.offset,
            order: params.order,
            includeArtifacts: params.includeArtifacts,
          });
          return { id: req.id, result };
        }

        case "sessions.messages":
        case "messages.list": {
          if (!params.sessionId) {
            throw new Error("Missing sessionId param");
          }
          const result = await handleMessagesGet({
            cli: params.cli,
            sessionId: params.sessionId,
            limit: params.limit,
            offset: params.offset,
            order: params.order,
          });
          return { id: req.id, result };
        }

        case "agent.run": {
          const prompt = params.options?.prompt || params.prompt;
          if (!prompt) {
            throw new Error("Missing prompt param");
          }
          const options = {
            prompt,
            sessionId: params.options?.sessionId || params.sessionId,
            cwd: params.options?.cwd || params.cwd,
            ...(params.options || {}),
          };

          if (!onStream) {
            throw new Error("Streaming callback is required for agent.run");
          }

          // Stream execution chunks
          const stream = handleAgentRun({
            cli: params.cli,
            options,
          });

          for await (const event of stream) {
            onStream({
              id: req.id,
              stream: true,
              event,
            });
          }

          return { id: req.id, result: { completed: true }, done: true };
        }

        case "agent.cancel": {
          if (!params.sessionId) {
            throw new Error("Missing sessionId param");
          }
          const result = await handleAgentCancel({
            cli: params.cli,
            sessionId: params.sessionId,
          });
          return { id: req.id, result };
        }

        case "agent.respondPermission": {
          if (!params.sessionId || !params.requestId) {
            throw new Error("Missing sessionId or requestId");
          }
          const result = await handleRespondPermission({
            cli: params.cli,
            sessionId: params.sessionId,
            requestId: params.requestId,
            allow: Boolean(params.allow),
          });
          return { id: req.id, result };
        }

        case "fs.tree": {
          const dir = params.path || process.cwd();
          const tree = buildFileTree(dir, params.maxDepth || 4);
          return { id: req.id, result: tree };
        }

        case "fs.read": {
          if (!params.path) throw new Error("Missing path param");
          const content = readFileContent(params.path);
          return { id: req.id, result: { content } };
        }

        case "fs.write": {
          if (!params.path || typeof params.content !== "string") {
            throw new Error("Missing path or content param");
          }
          writeFileContent(params.path, params.content);
          return { id: req.id, result: { ok: true } };
        }

        case "workspaces.list": {
          // Query sessions from the adapter to gather unique recent workspaces
          const sessionsResult = await handleSessionsList({ cli: params.cli, limit: 100 });
          const workspacesMap = new Map<string, { path: string; name: string; lastUsed: string }>();

          // Always include current process cwd as baseline
          const cwd = process.cwd();
          workspacesMap.set(path.normalize(cwd).toLowerCase(), {
            path: cwd,
            name: path.basename(cwd) || cwd,
            lastUsed: new Date().toISOString(),
          });

          // Extract from existing sessions
          for (const sess of sessionsResult.items) {
            if (sess.workspacePath && sess.workspacePath.trim() !== "") {
              const cleanPath = sess.workspacePath;
              const key = path.normalize(cleanPath).toLowerCase();
              if (!workspacesMap.has(key)) {
                workspacesMap.set(key, {
                  path: cleanPath,
                  name: (sess as any).workspaceName || path.basename(cleanPath) || cleanPath,
                  lastUsed: sess.updatedAt || sess.createdAt || new Date().toISOString(),
                });
              }
            }
          }

          const workspaces = Array.from(workspacesMap.values()).sort((a, b) => {
            return new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime();
          });

          return { id: req.id, result: { workspaces } };
        }

        case "fs.listDirs": {
          const targetPath = params.parentPath || params.path;
          const result = listDirectories(targetPath);
          return { id: req.id, result };
        }

        default:
          return { id: req.id, error: `Method not found: ${req.method}` };
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { id: req.id, error: message };
    }
  }
}

export const rpcDispatcher = new RpcDispatcher();
