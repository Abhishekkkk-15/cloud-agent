import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn, execSync, type ChildProcess } from "node:child_process";
import { registry } from "../registry.js";
import {
  handleSessionsList,
  handleSessionsGet,
  handleMessagesGet,
  handleSessionRename,
  handleSessionDelete,
  handleSessionPin,
} from "./session.js";
import { handleAgentRun, handleAgentCancel, handleRespondPermission } from "./run.js";
import {
  buildFileTree,
  readFileContent,
  writeFileContent,
  listDirectories,
  createDirectory,
  saveSessionAttachment,
} from "./fs.js";
import { loadConfig } from "../config.js";
import { proxyLocalHttp, checkPortListening, getLocalIpAddresses } from "../tunnel.js";
import {
  handleAutoHealerTrigger,
  handleAutoHealerApprove,
  handleAutoPrReview,
  handlePostPrReview,
} from "./auto-healer.js";
import {
  handleGithubStatus,
  handleGithubConfigure,
  handleGithubSetToken,
  handleGithubTestConnection,
  handleGithubRemoveToken,
} from "./github.js";
import { sessionStreamHub } from "./stream-hub.js";
import { restartService, stopService } from "../service.js";
import { getLogFilePath } from "../logger.js";
import type { CliEvent } from "@cloud-agent/cli-interface";

const activeTerminalProcesses = new Map<string, ChildProcess>();

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
          return {
            id: req.id,
            result: {
              pong: true,
              timestamp: new Date().toISOString(),
              uptime: process.uptime(),
            },
          };

        case "daemon.status": {
          const avail = await registry.checkAll();
          const telemetry = getSystemTelemetry();
          let capabilities = null;
          try {
            const activeAdapter = registry.get(params.cli);
            capabilities = await activeAdapter.getCapabilities();
            const cfg = loadConfig();
            if (cfg.allowFileUpload === false && capabilities) {
              capabilities.allowFileUpload = false;
            }
          } catch {
            // ignore if no adapter registered yet
          }
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
              capabilities,
            },
          };
        }

        case "cli.capabilities": {
          const adapter = registry.get(params.cli);
          const capabilities = await adapter.getCapabilities();
          const cfg = loadConfig();
          if (cfg.allowFileUpload === false && capabilities) {
            capabilities.allowFileUpload = false;
          }
          return { id: req.id, result: capabilities };
        }

        case "cli.models": {
          const adapter = registry.get(params.cli);
          const models =
            typeof adapter.listModels === "function"
              ? await adapter.listModels()
              : (await adapter.getCapabilities()).models.fallbackModels;
          return { id: req.id, result: { models } };
        }

        case "sessions.list": {
          const result = await handleSessionsList({
            cli: params.cli,
            workspaceFilter: params.workspaceFilter,
            limit: params.limit,
            offset: params.offset,
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

        case "sessions.rename": {
          if (!params.sessionId || !params.title) {
            throw new Error("Missing sessionId or title parameter");
          }
          const result = await handleSessionRename({
            cli: params.cli,
            sessionId: params.sessionId,
            title: params.title,
          });
          return { id: req.id, result };
        }

        case "sessions.delete": {
          if (!params.sessionId) {
            throw new Error("Missing sessionId parameter");
          }
          const result = await handleSessionDelete({
            cli: params.cli,
            sessionId: params.sessionId,
          });
          return { id: req.id, result };
        }

        case "sessions.pin": {
          if (!params.sessionId || params.pinned === undefined) {
            throw new Error("Missing sessionId or pinned parameter");
          }
          const result = await handleSessionPin({
            cli: params.cli,
            sessionId: params.sessionId,
            pinned: Boolean(params.pinned),
          });
          return { id: req.id, result };
        }

        case "agent.run": {
          const prompt = params.options?.prompt || params.prompt;
          if (!prompt) {
            throw new Error("Missing prompt param");
          }
          const rawSessionId = params.options?.sessionId || params.sessionId;
          const sessionId =
            rawSessionId && rawSessionId !== "default"
              ? rawSessionId
              : crypto.randomUUID();

          const targetCwd = params.options?.cwd || params.cwd;
          const attachments = params.attachments || params.options?.attachments;
          const options = {
            ...(params.options || {}),
            prompt,
            sessionId,
            ...(targetCwd ? { cwd: targetCwd } : {}),
            ...(attachments ? { attachments } : {}),
          };

          if (!onStream) {
            throw new Error("Streaming callback is required for agent.run");
          }

          const adapter = registry.get(params.cli);

          // If a turn is already running for this session, attach caller as live subscriber
          if (typeof adapter.isTurnRunning === "function" && adapter.isTurnRunning(sessionId)) {
            console.log(`[RpcDispatcher] Session ${sessionId} already has an active turn running. Attaching caller as live subscriber.`);

            // 1. Replay current turn buffered events
            const buffer = sessionStreamHub.getBufferedEvents(sessionId);
            for (const event of buffer) {
              onStream({ id: req.id, stream: true, event });
            }

            // 2. Stream until active turn finishes
            return new Promise<RpcResponse>((resolve) => {
              const unsub = sessionStreamHub.subscribe(sessionId, (chunk) => {
                if (chunk.event) {
                  onStream({ id: req.id, stream: true, event: chunk.event });
                }
                if (chunk.done) {
                  unsub();
                  resolve({
                    id: req.id,
                    result: { completed: true, sessionId, ...(chunk.result || {}) },
                    done: true,
                  });
                }
              });

              if (typeof adapter.isTurnRunning === "function" && !adapter.isTurnRunning(sessionId)) {
                unsub();
                resolve({
                  id: req.id,
                  result: { completed: true, sessionId },
                  done: true,
                });
              }
            });
          }

          // Register new active turn in the stream hub
          sessionStreamHub.startTurn(sessionId);

          // Deliver directly to the primary caller
          const unsubCaller = sessionStreamHub.subscribe(sessionId, (chunk) => {
            if (chunk.event) {
              onStream({ id: req.id, stream: true, event: chunk.event });
            }
          });

          // Stream execution chunks
          const stream = handleAgentRun({
            cli: params.cli,
            options,
          });

          let isCommand = false;
          try {
            for await (const event of stream) {
              if ((event as any).data?.isCommand) {
                isCommand = true;
              }
              if (!event.sessionId) {
                event.sessionId = sessionId;
              }
              sessionStreamHub.broadcast(sessionId, event);
            }
          } finally {
            unsubCaller();
            sessionStreamHub.endTurn(sessionId, { completed: true, isCommand, sessionId });
          }

          return {
            id: req.id,
            result: { completed: true, isCommand, sessionId },
            done: true,
          };
        }

        case "agent.subscribe":
        case "sessions.subscribe": {
          const sessionId = params.sessionId || params.options?.sessionId;
          if (!sessionId) {
            throw new Error("Missing sessionId param");
          }

          const adapter = registry.get(params.cli);
          const isRunning = typeof adapter.isTurnRunning === "function" ? adapter.isTurnRunning(sessionId) : false;

          if (!isRunning || !onStream) {
            return {
              id: req.id,
              result: { sessionId, isRunning: false },
            };
          }

          console.log(`[RpcDispatcher] Client subscribed to live session ${sessionId}`);

          // 1. Replay buffered events of the active turn
          const buffer = sessionStreamHub.getBufferedEvents(sessionId);
          for (const event of buffer) {
            onStream({
              id: req.id,
              stream: true,
              event,
            });
          }

          // 2. Subscribe to subsequent live events until completion
          return new Promise<RpcResponse>((resolve) => {
            const unsub = sessionStreamHub.subscribe(sessionId, (chunk) => {
              if (chunk.event) {
                onStream({
                  id: req.id,
                  stream: true,
                  event: chunk.event,
                });
              }
              if (chunk.done) {
                unsub();
                resolve({
                  id: req.id,
                  result: { completed: true, sessionId, ...(chunk.result || {}) },
                  done: true,
                });
              }
            });

            // Guard: in case turn already finished
            if (typeof adapter.isTurnRunning === "function" && !adapter.isTurnRunning(sessionId)) {
              unsub();
              resolve({
                id: req.id,
                result: { completed: true, sessionId },
                done: true,
              });
            }
          });
        }

        case "agent.status": {
          const sessionId = params.sessionId || params.options?.sessionId;
          if (!sessionId) {
            throw new Error("Missing sessionId param");
          }
          const adapter = registry.get(params.cli);
          const isRunning = typeof adapter.isTurnRunning === "function" ? adapter.isTurnRunning(sessionId) : false;
          return {
            id: req.id,
            result: {
              sessionId,
              isRunning,
            },
          };
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

        case "agent.approve":
        case "agent.respondPermission": {
          const reqId = params.requestId || params.approvalId || req.id;
          const allow = params.allow !== undefined ? Boolean(params.allow) : Boolean(params.allowed);
          const result = await handleRespondPermission({
            cli: params.cli,
            sessionId: params.sessionId || "default",
            requestId: reqId,
            allow,
          });
          return { id: req.id, result };
        }

        case "auto_healer.trigger": {
          if (!params.incident) {
            throw new Error("Missing 'incident' param for auto_healer.trigger");
          }
          const result = await handleAutoHealerTrigger({
            cli: params.cli,
            incident: params.incident,
          });
          return { id: req.id, result };
        }

        case "auto_healer.approve": {
          if (!params.incidentId || !params.branchName || !params.action) {
            throw new Error("Missing incidentId, branchName, or action for auto_healer.approve");
          }
          const result = await handleAutoHealerApprove({
            incidentId: params.incidentId,
            branchName: params.branchName,
            action: params.action,
            workspacePath: params.workspacePath,
          });
          return { id: req.id, result };
        }

        case "auto_healer.pr_review": {
          if (!params.pr) {
            throw new Error("Missing 'pr' param for auto_healer.pr_review");
          }
          const result = await handleAutoPrReview({
            cli: params.cli,
            pr: params.pr,
          });
          return { id: req.id, result };
        }

        case "auto_healer.post_pr_review": {
          if (!params.prNumber || !params.verdict) {
            throw new Error("Missing prNumber or verdict for auto_healer.post_pr_review");
          }
          const result = await handlePostPrReview({
            prNumber: params.prNumber,
            verdict: params.verdict,
            body: params.body,
            workspacePath: params.workspacePath,
          });
          return { id: req.id, result };
        }

        case "github.status": {
          const result = await handleGithubStatus();
          return { id: req.id, result };
        }

        case "github.configure": {
          if (!params.token || typeof params.token !== "string") {
            throw new Error("Missing or invalid token parameter for github.configure");
          }
          const result = await handleGithubConfigure({
            token: params.token,
            userName: typeof params.userName === "string" ? params.userName : undefined,
            email: typeof params.email === "string" ? params.email : undefined,
            configureGitCredentials: params.configureGitCredentials !== false,
          });
          return { id: req.id, result };
        }

        case "github.setToken": {
          if (!params.token || typeof params.token !== "string") {
            throw new Error("Missing or invalid token parameter for github.setToken");
          }
          const result = await handleGithubConfigure({
            token: params.token,
            userName: typeof params.userName === "string" ? params.userName : undefined,
            email: typeof params.email === "string" ? params.email : undefined,
            configureGitCredentials: params.configureGitCredentials !== false,
          });
          return { id: req.id, result };
        }

        case "github.testConnection": {
          const result = await handleGithubTestConnection();
          return { id: req.id, result };
        }

        case "github.removeToken": {
          const result = await handleGithubRemoveToken();
          return { id: req.id, result };
        }

        case "terminal.exec": {
          const command = params.command;
          if (!command || typeof command !== "string") {
            throw new Error("Missing or invalid command parameter");
          }
          const cwd = params.cwd || process.cwd();
          const startTime = Date.now();

          return new Promise<RpcResponse>((resolve) => {
            const child = spawn(command, {
              shell: true,
              cwd,
              env: { ...process.env, ...(params.env || {}) },
            });

            activeTerminalProcesses.set(req.id, child);

            const streamChunk = (text: string, streamType: "stdout" | "stderr") => {
              if (onStream) {
                onStream({
                  id: req.id,
                  stream: true,
                  event: {
                    type: "terminal.output" as any,
                    sessionId: req.id,
                    timestamp: new Date().toISOString(),
                    data: { text, stream: streamType } as any,
                  },
                });
              }
            };

            child.stdout?.on("data", (chunk: Buffer) => {
              streamChunk(chunk.toString("utf-8"), "stdout");
            });

            child.stderr?.on("data", (chunk: Buffer) => {
              streamChunk(chunk.toString("utf-8"), "stderr");
            });

            child.on("error", (err: Error) => {
              activeTerminalProcesses.delete(req.id);
              streamChunk(`Process error: ${err.message}\n`, "stderr");
              resolve({
                id: req.id,
                result: { exitCode: 1, error: err.message, durationMs: Date.now() - startTime },
                done: true,
              });
            });

            child.on("close", (code: number | null) => {
              activeTerminalProcesses.delete(req.id);
              resolve({
                id: req.id,
                result: { exitCode: code ?? 0, durationMs: Date.now() - startTime },
                done: true,
              });
            });
          });
        }

        case "terminal.kill": {
          const targetId = params.targetId || req.id;
          const child = activeTerminalProcesses.get(targetId);
          if (child && !child.killed) {
            if (process.platform === "win32" && child.pid) {
              try {
                execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: "ignore" });
              } catch {
                // Process may have already exited
              }
            } else {
              child.kill("SIGTERM");
              setTimeout(() => {
                if (!child.killed) child.kill("SIGKILL");
              }, 1000);
            }
            activeTerminalProcesses.delete(targetId);
            return { id: req.id, result: { killed: true, targetId } };
          }
          return { id: req.id, result: { killed: false, message: "Process not found or already exited" } };
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

        case "agent.upload_attachment":
        case "attachment.upload": {
          const cfg = loadConfig();
          let adapterAllowed = true;
          try {
            const adapter = registry.get(params.cli);
            const caps = await adapter.getCapabilities();
            if (caps && caps.allowFileUpload === false) {
              adapterAllowed = false;
            }
          } catch {
            // ignore if no adapter specified
          }

          if (cfg.allowFileUpload === false || !adapterAllowed) {
            throw new Error("File uploads are disabled by CLI adapter capability or host daemon configuration");
          }

          const rawSessionId = params.sessionId || params.options?.sessionId;
          const sessionId =
            rawSessionId && rawSessionId !== "default"
              ? rawSessionId
              : crypto.randomUUID();
          const filename = params.filename || params.name;
          const base64 = params.base64 || params.content;
          if (!filename || !base64) {
            throw new Error("Missing filename or base64 data");
          }
          const result = saveSessionAttachment(
            sessionId,
            filename,
            base64,
            params.mimeType,
            params.targetPath || params.targetDirectory
          );
          return { id: req.id, result };
        }

        case "fs.write": {
          if (!params.path || typeof params.content !== "string") {
            throw new Error("Missing path or content param");
          }
          const encoding = params.encoding === "base64" ? "base64" : "utf8";
          writeFileContent(params.path, params.content, encoding);
          return { id: req.id, result: { ok: true } };
        }

        case "workspaces.list": {
          const config = loadConfig();
          const configuredWorkspaces = config.allowedWorkspaces || [];

          // Query sessions from the adapter to gather unique recent workspaces
          const sessionsResult = await handleSessionsList({ cli: params.cli, limit: 100 });
          const workspacesMap = new Map<string, { path: string; name: string; lastUsed: string }>();

          // Include configured allowed workspaces first
          for (const wsPath of configuredWorkspaces) {
            if (wsPath && wsPath.trim() !== "") {
              const cleanPath = path.normalize(wsPath);
              const key = cleanPath.toLowerCase();
              if (!workspacesMap.has(key)) {
                workspacesMap.set(key, {
                  path: cleanPath,
                  name: path.basename(cleanPath) || cleanPath,
                  lastUsed: new Date().toISOString(),
                });
              }
            }
          }

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

          // Include current process cwd as fallback if no session workspaces exist
          const cwd = process.cwd();
          const cwdKey = path.normalize(cwd).toLowerCase();
          const homeDir = os.homedir();
          const isHomeDir = path.normalize(cwd).toLowerCase() === path.normalize(homeDir).toLowerCase();
          const hasProjectIndicators =
            fs.existsSync(path.join(cwd, ".git")) ||
            fs.existsSync(path.join(cwd, ".agents")) ||
            fs.existsSync(path.join(cwd, "package.json")) ||
            fs.existsSync(path.join(cwd, "pyproject.toml"));

          if (!workspacesMap.has(cwdKey)) {
            // If cwd is the raw user home directory without project files, don't prioritize it over actual workspaces
            if (!isHomeDir || hasProjectIndicators || workspacesMap.size === 0) {
              workspacesMap.set(cwdKey, {
                path: cwd,
                name: path.basename(cwd) || cwd,
                lastUsed: workspacesMap.size === 0 ? new Date().toISOString() : new Date(0).toISOString(),
              });
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

        case "fs.createDir":
        case "fs.mkdir": {
          const parent = params.parentPath || params.path;
          const name = params.name || params.folderName;
          if (!parent) {
            throw new Error("Missing parentPath param");
          }
          const result = createDirectory(parent, name);
          return { id: req.id, result };
        }

        case "tunnel.proxy_request": {
          const port = parseInt(String(params.port), 10);
          if (isNaN(port) || port < 1 || port > 65535) {
            throw new Error(`Invalid local port: ${params.port}`);
          }
          const result = await proxyLocalHttp({
            port,
            method: params.method || "GET",
            path: params.path || "/",
            headers: params.headers || {},
            bodyBase64: params.bodyBase64,
          });
          return { id: req.id, result };
        }

        case "preview.check_port": {
          const port = parseInt(String(params.port), 10);
          if (isNaN(port) || port < 1 || port > 65535) {
            throw new Error(`Invalid local port: ${params.port}`);
          }
          const listening = await checkPortListening(port);
          const lanIps = getLocalIpAddresses();
          return {
            id: req.id,
            result: {
              port,
              listening,
              lanIps,
              hostname: os.hostname(),
              localUrl: `http://localhost:${port}`,
              lanUrl: lanIps.length > 0 ? `http://${lanIps[0]}:${port}` : undefined,
            },
          };
        }

        case "preview.detect_project": {
          const targetCwd = params.cwd || process.cwd();
          const pkgPath = path.join(targetCwd, "package.json");
          let isReact = false;
          let isVite = false;
          let isNext = false;
          let devScript: string | undefined = undefined;
          let scripts: Record<string, string> = {};

          if (fs.existsSync(pkgPath)) {
            try {
              const raw = fs.readFileSync(pkgPath, "utf-8");
              const pkg = JSON.parse(raw);
              scripts = pkg.scripts || {};
              const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
              isReact = Boolean(deps.react || deps["react-dom"]);
              isVite = Boolean(deps.vite);
              isNext = Boolean(deps.next);
              devScript = scripts.dev ? "dev" : scripts.start ? "start" : undefined;
            } catch {}
          }

          return {
            id: req.id,
            result: {
              hasPackageJson: fs.existsSync(pkgPath),
              isReact,
              isVite,
              isNext,
              devScript,
              scripts,
              cwd: targetCwd,
            },
          };
        }

        case "preview.start_server": {
          const targetCwd = params.cwd || process.cwd();
          const cmd = params.command || (params.script ? `npm run ${params.script}` : "npm run dev");
          const child = spawn(cmd, {
            cwd: targetCwd,
            shell: true,
            detached: true,
            stdio: "ignore",
          });
          child.unref();

          return {
            id: req.id,
            result: {
              ok: true,
              pid: child.pid,
              command: cmd,
              cwd: targetCwd,
            },
          };
        }

        case "daemon.workers": {
          const adapter = registry.get(params.cli);
          const workers = typeof adapter.listWorkers === "function" ? await adapter.listWorkers() : [];
          return { id: req.id, result: { workers } };
        }

        case "daemon.kill_worker": {
          const sessionId = params.sessionId;
          if (!sessionId || typeof sessionId !== "string") {
            throw new Error("Missing sessionId parameter for daemon.kill_worker");
          }
          const adapter = registry.get(params.cli);

          // Only abort turn stream if session was actively executing (Review Focus 1 & Issue 2)
          const isTurnBusy =
            (typeof adapter.isTurnRunning === "function" && adapter.isTurnRunning(sessionId)) ||
            sessionStreamHub.hasActiveTurn(sessionId);

          if (isTurnBusy) {
            sessionStreamHub.broadcast(sessionId, {
              type: "status",
              sessionId,
              timestamp: new Date().toISOString(),
              data: { status: "error", message: "Process terminated by operator" },
            });
            sessionStreamHub.endTurn(sessionId, { error: "Process terminated by operator" });
          }

          const killed = typeof adapter.killWorker === "function" ? await adapter.killWorker(sessionId) : false;
          return { id: req.id, result: { ok: Boolean(killed), killed, sessionId } };
        }

        case "daemon.restart_worker": {
          const sessionId = params.sessionId;
          if (!sessionId || typeof sessionId !== "string") {
            throw new Error("Missing sessionId parameter for daemon.restart_worker");
          }
          const adapter = registry.get(params.cli);

          // Only abort turn stream if session was actively executing (Review Focus 1 & Issue 2)
          const isTurnBusy =
            (typeof adapter.isTurnRunning === "function" && adapter.isTurnRunning(sessionId)) ||
            sessionStreamHub.hasActiveTurn(sessionId);

          if (isTurnBusy) {
            sessionStreamHub.broadcast(sessionId, {
              type: "status",
              sessionId,
              timestamp: new Date().toISOString(),
              data: { status: "error", message: "Process restarted by operator" },
            });
            sessionStreamHub.endTurn(sessionId, { error: "Process restarted by operator" });
          }

          const restarted = typeof adapter.restartWorker === "function" ? await adapter.restartWorker(sessionId) : false;
          return { id: req.id, result: { ok: Boolean(restarted), restarted, sessionId } };
        }

        case "daemon.kill_all_workers": {
          const adapter = registry.get(params.cli);
          const count = typeof adapter.killAllIdleWorkers === "function" ? await adapter.killAllIdleWorkers() : 0;
          return { id: req.id, result: { count } };
        }

        case "daemon.logs": {
          const linesRequested = typeof params.lines === "number" && params.lines > 0 ? params.lines : 100;
          const logPath = getLogFilePath();
          let lines: string[] = [];
          if (fs.existsSync(logPath)) {
            try {
              const raw = fs.readFileSync(logPath, "utf8");
              lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0).slice(-linesRequested);
            } catch {
              lines = [];
            }
          }
          return { id: req.id, result: { lines, path: logPath } };
        }

        case "daemon.restart": {
          if (!params.testDryRun) {
            setTimeout(async () => {
              try {
                await restartService(true);
              } catch (err) {
                console.error("[RpcDispatcher] Failed to execute daemon self-restart:", err);
              }
            }, 350);
          }
          return { id: req.id, result: { ok: true, message: "Restarting daemon service..." } };
        }

        case "daemon.stop": {
          if (!params.testDryRun) {
            setTimeout(async () => {
              try {
                await stopService();
              } catch (err) {
                console.error("[RpcDispatcher] Failed to stop daemon service:", err);
              }
            }, 350);
          }
          return { id: req.id, result: { ok: true, message: "Stopping daemon service..." } };
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
