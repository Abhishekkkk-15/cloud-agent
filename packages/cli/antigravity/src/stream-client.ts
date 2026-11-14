import fs from "node:fs";
import path from "node:path";
import { spawn, execFile, type ChildProcess } from "node:child_process";
import { promisify } from "node:util";
import readline from "node:readline";
import crypto from "node:crypto";
import type { CliRunOptions, CliEvent, CliWorkerInfo, CliAttachment } from "@cloud-agent/cli-interface";
import { getAgyBinaryPath, getBrainDir } from "./paths.js";
import { mapAntigravityStreamEvent } from "./mapper.js";
import { getBrainSession, writeSessionMeta } from "./transcript-reader.js";

const execFileAsync = promisify(execFile);

const BUILTIN_CLI_COMMANDS = new Set([
  "/help",
  "/skills",
  "/models",
  "/agents",
  "/agent",
  "/mcp",
  "/usage",
  "/quota",
  "/changelog",
  "/credits",
  "/config",
  "/settings",
  "/permissions",
  "/hooks",
]);

function getBuiltinCliCommand(prompt: string): string | null {
  const trimmed = prompt.trim();
  const firstWord = trimmed.split(/\s+/)[0]?.toLowerCase();
  if (firstWord && BUILTIN_CLI_COMMANDS.has(firstWord)) {
    return trimmed;
  }
  return null;
}

function getSubcommandForBuiltin(cmd: string): { args: string[]; stripAnsi?: boolean } {
  const parts = cmd.trim().split(/\s+/);
  const name = parts[0].toLowerCase();
  const rest = parts.slice(1);

  switch (name) {
    case "/usage":
    case "/quota":
    case "/credits":
      return { args: ["--print", "/usage"] };

    case "/models":
      return { args: ["models", ...rest], stripAnsi: true };

    case "/mcp":
      return { args: ["mcp", ...(rest.length > 0 ? rest : ["list"])], stripAnsi: true };

    case "/changelog":
      return { args: ["changelog", ...rest] };

    case "/help":
      return { args: ["help", ...rest] };

    case "/agents":
    case "/agent":
      return { args: ["agents", ...rest], stripAnsi: true };

    case "/skills":
      return { args: ["--print", "/skills"] };

    case "/permissions":
    case "/config":
    case "/settings":
    case "/hooks":
    default:
      return { args: ["--print", cmd] };
  }
}

function cleanCliOutput(raw: string): string {
  return raw
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "")
    .replace(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/g, "")
    .replace(/Fetching available models\.\.\./g, "")
    .trim();
}

function appendCommandToTranscript(
  sessionId: string,
  prompt: string,
  output: string
): void {
  try {
    const brainDir = getBrainDir();
    const transcriptPath = path.join(
      brainDir,
      sessionId,
      ".system_generated",
      "logs",
      "transcript.jsonl"
    );

    const logsDir = path.dirname(transcriptPath);
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    const content = fs.existsSync(transcriptPath) ? fs.readFileSync(transcriptPath, "utf-8") : "";
    const lines = content.split("\n").filter((l) => l.trim().length > 0);
    let nextStepIndex = lines.length;
    if (lines.length > 0) {
      try {
        const lastObj = JSON.parse(lines[lines.length - 1]);
        if (typeof lastObj.step_index === "number") {
          nextStepIndex = lastObj.step_index + 1;
        }
      } catch {
        // ignore parse error
      }
    }

    const now = new Date().toISOString();
    const userLine = JSON.stringify({
      step_index: nextStepIndex,
      source: "USER_EXPLICIT",
      type: "USER_INPUT",
      status: "DONE",
      created_at: now,
      content: `<USER_REQUEST>\n${prompt}\n</USER_REQUEST>`,
    });

    const assistantLine = JSON.stringify({
      step_index: nextStepIndex + 1,
      source: "MODEL",
      type: "PLANNER_RESPONSE",
      status: "DONE",
      created_at: now,
      content: output,
      tool_calls: [],
    });

    fs.appendFileSync(transcriptPath, `${userLine}\n${assistantLine}\n`, "utf-8");
  } catch (err) {
    console.warn(`[stream-client] Failed to append command turn to transcript for ${sessionId}:`, err);
  }
}

type QueueItem = { event?: CliEvent; error?: Error; done?: boolean };

/**
 * Manages a persistent, long-lived Antigravity CLI process for a specific session.
 * Keeps stdin open across multiple user turns so each subsequent message starts
 * streaming immediately with zero process respawn or transcript re-reading overhead.
 */
class PersistentWorker {
  readonly sessionId: string;
  readonly options: CliRunOptions;
  readonly startedAt: string = new Date().toISOString();
  lastActiveAt: string = new Date().toISOString();
  private child: ChildProcess;
  private isAlive = true;
  private queue: QueueItem[] = [];
  private resolveWait: (() => void) | null = null;
  private idleTimer: NodeJS.Timeout | null = null;
  private isTurnRunning = false;
  readonly activeModel?: string;
  readonly activeEffort?: string;
  readonly activeMode?: string;
  readonly activeDangerouslySkipPermissions: boolean;
  readonly activeCwd?: string;

  constructor(
    binary: string,
    options: CliRunOptions,
    sessionId: string,
    private onExit: (worker: PersistentWorker) => void
  ) {
    this.sessionId = sessionId;
    this.options = options;
    this.activeModel = options.model;
    this.activeEffort = options.effort;
    this.activeMode = options.mode;
    this.activeDangerouslySkipPermissions = options.dangerouslySkipPermissions !== false;
    this.activeCwd = options.cwd ? path.normalize(options.cwd).toLowerCase() : undefined;

    const args: string[] = [
      "--input-format",
      "stream-json",
      "--output-format",
      "stream-json",
      "--print",
      "",
    ];

    if (options.sessionId) {
      args.push("--conversation", options.sessionId);
    }
    if (options.model) {
      args.push("--model", options.model);
    }
    if (options.effort) {
      args.push("--effort", options.effort);
    }
    if (options.mode) {
      args.push("--mode", options.mode);
    }
    if (this.activeDangerouslySkipPermissions) {
      args.push("--dangerously-skip-permissions");
    }

    const env = {
      ...process.env,
      ...options.env,
    };

    this.child = spawn(binary, args, {
      cwd: options.cwd,
      env,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });

    this.setupListeners();
    this.resetIdleTimer();
  }

  get isRunning(): boolean {
    return this.isAlive && !this.child.killed;
  }

  get isBusy(): boolean {
    return this.isRunning && this.isTurnRunning;
  }

  get pid(): number | undefined {
    return this.child?.pid;
  }

  getWorkerInfo(sessionTitle?: string, workspaceName?: string): CliWorkerInfo {
    return {
      sessionId: this.sessionId,
      sessionTitle,
      workspacePath: this.options.cwd || this.activeCwd,
      workspaceName: workspaceName || (this.activeCwd ? path.basename(this.activeCwd) : undefined),
      pid: this.pid,
      isRunning: this.isRunning,
      isBusy: this.isBusy,
      activeModel: this.activeModel,
      activeEffort: this.activeEffort,
      activeMode: this.activeMode,
      activeCwd: this.activeCwd,
      startedAt: this.startedAt,
      lastActiveAt: this.lastActiveAt,
    };
  }

  hasConfigChanged(options: CliRunOptions): boolean {
    if (options.model && options.model !== this.activeModel) return true;
    if (options.effort && options.effort !== this.activeEffort) return true;
    if (options.mode && options.mode !== this.activeMode) return true;
    const targetSkip = options.dangerouslySkipPermissions !== false;
    if (targetSkip !== this.activeDangerouslySkipPermissions) return true;
    if (options.cwd) {
      const normTargetCwd = path.normalize(options.cwd).toLowerCase();
      if (!this.activeCwd || normTargetCwd !== this.activeCwd) return true;
    }
    return false;
  }

  respondPermission(requestId: string, allow: boolean): boolean {
    if (!this.isRunning || !this.child.stdin?.writable) return false;
    try {
      const payload =
        JSON.stringify({
          event: "permission_response",
          id: requestId,
          allow,
          allowed: allow,
        }) + "\n";
      this.child.stdin.write(payload);
      // Also write standard interactive fallback line
      this.child.stdin.write(allow ? "y\n" : "n\n");
      return true;
    } catch (err) {
      console.error(`[PersistentWorker] Failed to write permission response:`, err);
      return false;
    }
  }

  private pushItem(item: QueueItem): void {
    this.queue.push(item);
    if (this.resolveWait) {
      this.resolveWait();
      this.resolveWait = null;
    }
  }

  private resetIdleTimer(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    // Reap idle session process after 20 minutes of no user turns
    this.idleTimer = setTimeout(() => {
      if (!this.isTurnRunning) {
        this.destroy();
      }
    }, 20 * 60 * 1000);
  }

  private setupListeners(): void {
    const rlOut = readline.createInterface({
      input: this.child.stdout!,
      crlfDelay: Infinity,
    });

    rlOut.on("line", (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      try {
        const parsed = JSON.parse(trimmed) as Record<string, unknown>;
        const mappedEvents = mapAntigravityStreamEvent(this.sessionId, parsed);
        for (const ev of mappedEvents) {
          this.pushItem({ event: ev });
        }

        // When a turn completes, Antigravity emits a 'result' event.
        // We signal that this turn is done WITHOUT killing the persistent child process!
        if (parsed.event === "result") {
          this.isTurnRunning = false;
          this.resetIdleTimer();
          this.checkTranscriptForThoughts();
          this.pushItem({ done: true });
        }
      } catch {
        this.pushItem({
          event: {
            type: "text_chunk",
            sessionId: this.sessionId,
            timestamp: new Date().toISOString(),
            data: { text: trimmed + "\n", delta: true },
          },
        });
      }
    });

    const rlErr = readline.createInterface({
      input: this.child.stderr!,
      crlfDelay: Infinity,
    });

    rlErr.on("line", (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      this.pushItem({
        event: {
          type: "status",
          sessionId: this.sessionId,
          timestamp: new Date().toISOString(),
          data: { status: "thinking", message: trimmed },
        },
      });
    });

    this.child.on("error", (err: Error) => {
      this.isAlive = false;
      this.pushItem({
        event: {
          type: "error",
          sessionId: this.sessionId,
          timestamp: new Date().toISOString(),
          data: { error: err.message },
        },
      });
      this.pushItem({ done: true });
      this.onExit(this);
    });

    this.child.on("close", (code: number | null) => {
      this.isAlive = false;
      if (this.isTurnRunning) {
        this.pushItem({
          event: {
            type: "status",
            sessionId: this.sessionId,
            timestamp: new Date().toISOString(),
            data: {
              status: code === 0 ? "done" : "error",
              message: code === 0 ? "Turn completed" : `Process exited with code ${code}`,
            },
          },
        });
        this.pushItem({ done: true });
      }
      this.onExit(this);
    });
  }

  private lastCheckedTranscriptLine = 0;

  private checkTranscriptForThoughts(): void {
    try {
      const brainDir = getBrainDir();
      const logsDir = path.join(brainDir, this.sessionId, ".system_generated", "logs");
      const transcriptFullPath = path.join(logsDir, "transcript_full.jsonl");
      const transcriptPath = path.join(logsDir, "transcript.jsonl");

      // Prefer transcript_full.jsonl because it retains all thinking tokens without truncation
      const targetPath = fs.existsSync(transcriptFullPath) ? transcriptFullPath : transcriptPath;
      if (!fs.existsSync(targetPath)) return;

      const raw = fs.readFileSync(targetPath, "utf-8");
      const lines = raw.trim().split("\n");
      if (lines.length > this.lastCheckedTranscriptLine) {
        for (let i = this.lastCheckedTranscriptLine; i < lines.length; i++) {
          const l = lines[i]?.trim();
          if (!l) continue;
          try {
            const parsed = JSON.parse(l);
            let thinking = typeof parsed.thinking === "string" ? parsed.thinking : "";
            if (!thinking && typeof parsed.reasoning === "string") {
              thinking = parsed.reasoning;
            }
            if (!thinking && typeof parsed.thought === "string") {
              thinking = parsed.thought;
            }
            if (!thinking && fs.existsSync(transcriptFullPath) && targetPath !== transcriptFullPath) {
              try {
                const fullRaw = fs.readFileSync(transcriptFullPath, "utf-8");
                const fullLines = fullRaw.trim().split("\n");
                if (fullLines[i]) {
                  const fullParsed = JSON.parse(fullLines[i].trim());
                  if (typeof fullParsed.thinking === "string") {
                    thinking = fullParsed.thinking;
                  }
                }
              } catch {
                // ignore
              }
            }

            if (thinking && thinking.trim().length > 0) {
              this.pushItem({
                event: {
                  type: "thought",
                  sessionId: this.sessionId,
                  timestamp: parsed.created_at || new Date().toISOString(),
                  data: {
                    thought: thinking,
                    delta: false,
                  },
                },
              });
            }
          } catch {
            // ignore partial line parsing
          }
        }
        this.lastCheckedTranscriptLine = lines.length;
      }
    } catch {
      // ignore read error
    }
  }

  async *executeTurn(prompt: string, attachments?: CliAttachment[]): AsyncIterable<CliEvent> {
    this.isTurnRunning = true;
    this.lastActiveAt = new Date().toISOString();
    this.resetIdleTimer();

    // Initialize transcript cursor for new turn
    try {
      const brainDir = getBrainDir();
      const logsDir = path.join(brainDir, this.sessionId, ".system_generated", "logs");
      const fullPath = path.join(logsDir, "transcript_full.jsonl");
      const normalPath = path.join(logsDir, "transcript.jsonl");
      const targetPath = fs.existsSync(fullPath) ? fullPath : normalPath;
      if (fs.existsSync(targetPath)) {
        const raw = fs.readFileSync(targetPath, "utf-8");
        this.lastCheckedTranscriptLine = raw.trim().split("\n").length;
      } else {
        this.lastCheckedTranscriptLine = 0;
      }
    } catch {
      this.lastCheckedTranscriptLine = 0;
    }

    // Periodically inspect transcript during turn so thinking traces stream live
    const transcriptPollTimer = setInterval(() => {
      if (this.isTurnRunning) {
        this.checkTranscriptForThoughts();
      }
    }, 200);

    // Clear queue of any stale items
    this.queue = [];

    // Write input turn payload to stdin in Antigravity NDJSON format
    try {
      let effectivePrompt = prompt;
      const mediaList: Array<{ mime_type?: string; uri?: string }> = [];

      if (attachments && attachments.length > 0) {
        const attachmentNotes: string[] = [];
        for (const att of attachments) {
          const filePath = att.path || att.name;
          attachmentNotes.push(`[Attached File: ${filePath}]`);
          const normalizedPath = filePath.replace(/\\/g, "/");
          const fileUri = normalizedPath.startsWith("file://")
            ? normalizedPath
            : `file:///${normalizedPath.replace(/^\/+/, "")}`;
          mediaList.push({
            mime_type: att.mimeType || "application/octet-stream",
            uri: fileUri,
          });
        }
        effectivePrompt = `${attachmentNotes.join("\n")}\n\n${prompt}`;
      }

      const turnPayload =
        JSON.stringify({
          event: "user",
          message: {
            content: effectivePrompt,
            ...(mediaList.length > 0 ? { media: mediaList } : {}),
          },
        }) + "\n";

      this.child.stdin?.write(turnPayload);
    } catch (writeErr) {
      clearInterval(transcriptPollTimer);
      this.isTurnRunning = false;
      yield {
        type: "error",
        sessionId: this.sessionId,
        timestamp: new Date().toISOString(),
        data: { error: `Failed to write to stdin: ${String(writeErr)}` },
      };
      return;
    }

    // Async generator consumption loop
    try {
      while (true) {
        while (this.queue.length > 0) {
          const item = this.queue.shift()!;
          if (item.error) {
            throw item.error;
          }
          if (item.event) {
            yield item.event;
          }
          if (item.done) {
            return;
          }
        }

        await new Promise<void>((res) => {
          this.resolveWait = res;
        });
      }
    } finally {
      this.isTurnRunning = false;
      this.lastActiveAt = new Date().toISOString();
      clearInterval(transcriptPollTimer);
      this.checkTranscriptForThoughts();
    }
  }

  destroy(): void {
    this.isAlive = false;
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    if (!this.child.killed) {
      try {
        this.child.stdin?.end();
        this.child.kill("SIGINT");
        setTimeout(() => {
          if (!this.child.killed) {
            this.child.kill("SIGTERM");
          }
        }, 1500);
      } catch {
        // ignore
      }
    }
    this.onExit(this);
  }
}

interface DetectedCommand {
  isElevated: boolean;
  command?: string;
  tool?: string;
  description?: string;
}

const COMMON_TERMINAL_COMMANDS = new Set([
  "ls",
  "dir",
  "pwd",
  "cat",
  "type",
  "rm",
  "del",
  "erase",
  "mkdir",
  "md",
  "rmdir",
  "rd",
  "touch",
  "cp",
  "copy",
  "mv",
  "move",
  "git",
  "npm",
  "pnpm",
  "yarn",
  "bun",
  "npx",
  "python",
  "python3",
  "py",
  "node",
  "pip",
  "pip3",
  "uv",
  "cargo",
  "rustc",
  "go",
  "docker",
  "docker-compose",
  "kubectl",
  "ssh",
  "scp",
  "curl",
  "wget",
  "bash",
  "sh",
  "zsh",
  "powershell",
  "pwsh",
  "cmd",
  "ps",
  "kill",
  "taskkill",
  "chmod",
  "chown",
  "sudo",
  "grep",
  "find",
  "head",
  "tail",
  "echo",
  "get-childitem",
  "set-content",
  "remove-item",
]);

function detectElevatedCommand(prompt: string): DetectedCommand {
  const trimmed = prompt.trim();
  if (!trimmed) return { isElevated: false };

  // 1. Direct single-command check (e.g., "ls", "dir", "git status", "npm test")
  const firstWord = trimmed.split(/\s+/)[0]?.toLowerCase();
  if (firstWord && COMMON_TERMINAL_COMMANDS.has(firstWord)) {
    return {
      isElevated: true,
      command: trimmed,
      tool: "run_command",
      description: `Terminal command requested: ${trimmed}`,
    };
  }

  // 2. Natural language command execution prefixes (e.g. "run ls", "execute bash script", "rus ls")
  const runPrefixMatch = trimmed.match(
    /^(?:please\s+|can\s+you\s+|could\s+you\s+)?(?:run|rus|execute|exec|eval|perform|launch|start)\s+(?:the\s+)?(?:command\s+|script\s+)?(.*)$/i
  );
  if (runPrefixMatch && runPrefixMatch[1]) {
    const rawCmd = runPrefixMatch[1].trim();
    if (rawCmd.length > 0) {
      return {
        isElevated: true,
        command: rawCmd,
        tool: "run_command",
        description: `Command execution requested: ${rawCmd}`,
      };
    }
  }

  // 3. Sensitive / modifying actions (git commit, git push, delete, remove, drop)
  const sensitiveActionMatch = trimmed.match(
    /^(?:please\s+|can\s+you\s+)?(git\s+(?:commit|push|rebase|merge|reset)|(?:delete|remove|rm|drop|format)\s+.*)$/i
  );
  if (sensitiveActionMatch && sensitiveActionMatch[1]) {
    return {
      isElevated: true,
      command: sensitiveActionMatch[1].trim(),
      tool: "run_command",
      description: `Elevated system action requested: ${sensitiveActionMatch[1].trim()}`,
    };
  }

  return { isElevated: false };
}

interface PendingApproval {
  approvalId: string;
  command: string;
  resolve: (allowed: boolean) => void;
}

export class AntigravityStreamClient {
  private workers = new Map<string, PersistentWorker>();
  private pendingApprovals = new Map<string, PendingApproval>();

  /**
   * Runs an agent turn using a persistent session worker.
   * If a worker for this session already exists and is alive, reuses it immediately.
   * If not, spawns a warm worker that stays alive for subsequent turns.
   */
  isTurnRunning(sessionId: string): boolean {
    const worker = this.workers.get(sessionId);
    return Boolean(worker && worker.isBusy);
  }

  async *run(options: CliRunOptions): AsyncIterable<CliEvent> {
    const binary = getAgyBinaryPath() || "agy";
    const sessionId = options.sessionId || crypto.randomUUID();

    // 1. Resolve workspace cwd upfront for both built-in commands and LLM worker turns
    let effectiveCwd = options.cwd;
    if (!effectiveCwd && options.sessionId) {
      try {
        const sessDetail = await getBrainSession(options.sessionId);
        if (sessDetail?.workspacePath && sessDetail.workspacePath.trim() !== "") {
          effectiveCwd = sessDetail.workspacePath;
        }
      } catch {
        // ignore lookup failure
      }
    }

    const finalCwd = effectiveCwd || options.cwd || process.cwd();
    if (finalCwd && sessionId) {
      try {
        const brainDir = getBrainDir();
        const sessionDir = path.join(brainDir, sessionId);
        fs.mkdirSync(sessionDir, { recursive: true });
        writeSessionMeta(sessionDir, { workspacePath: finalCwd });
      } catch {
        // ignore
      }
    }

    // 2. Intercept CLI built-in utility commands (/help, /skills, /models, /mcp, /usage, etc.)
    const builtinCmd = getBuiltinCliCommand(options.prompt);
    if (builtinCmd) {
      yield {
        type: "status",
        sessionId,
        timestamp: new Date().toISOString(),
        data: { status: "thinking", message: `Executing Antigravity command ${builtinCmd}...`, isCommand: true },
      };

      try {
        const cmdConfig = getSubcommandForBuiltin(builtinCmd);
        const { stdout, stderr } = await execFileAsync(binary, cmdConfig.args, {
          cwd: finalCwd,
          env: { ...process.env, ...options.env },
        });

        let outputText = stdout || stderr || "Command executed with no output.";
        if (cmdConfig.stripAnsi) {
          outputText = cleanCliOutput(outputText);
        }

        // Persist to session transcript so session appears in transcripts and session trees
        appendCommandToTranscript(sessionId, options.prompt, outputText);

        yield {
          type: "text_chunk",
          sessionId,
          timestamp: new Date().toISOString(),
          data: { text: outputText, delta: false, isCommand: true },
        };

        yield {
          type: "status",
          sessionId,
          timestamp: new Date().toISOString(),
          data: { status: "done", message: "Command executed successfully", isCommand: true },
        };
      } catch (err: any) {
        yield {
          type: "text_chunk",
          sessionId,
          timestamp: new Date().toISOString(),
          data: {
            text: `⚠️ Error executing ${builtinCmd}: ${err?.message || String(err)}`,
            delta: false,
            isCommand: true,
          },
        };
        yield {
          type: "status",
          sessionId,
          timestamp: new Date().toISOString(),
          data: { status: "error", message: String(err), isCommand: true },
        };
      }
      return;
    }

    // 2. Standard prompt / workflow execution via persistent worker
    // 2a. HITL Security Gate: Intercept elevated commands if confirmation is enabled
    if (options.dangerouslySkipPermissions === false) {
      const detected = detectElevatedCommand(options.prompt);
      if (detected.isElevated) {
        const approvalId = `appr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

        yield {
          type: "permission_request",
          sessionId,
          timestamp: new Date().toISOString(),
          data: {
            id: approvalId,
            toolName: detected.tool || "run_command",
            command: detected.command || options.prompt,
            description: detected.description || "Elevated command execution requires operator approval",
            details: {
              command: detected.command || options.prompt,
              cwd: finalCwd,
            },
            defaultBehavior: "deny",
          },
        };

        const allowed = await new Promise<boolean>((resolve) => {
          this.pendingApprovals.set(sessionId, {
            approvalId,
            command: detected.command || options.prompt,
            resolve,
          });
        });

        this.pendingApprovals.delete(sessionId);

        if (!allowed) {
          yield {
            type: "text_chunk",
            sessionId,
            timestamp: new Date().toISOString(),
            data: {
              text: `🚫 **Action Denied**: Execution of \`${detected.command || options.prompt}\` was aborted by operator.\n`,
              delta: false,
            },
          };
          yield {
            type: "status",
            sessionId,
            timestamp: new Date().toISOString(),
            data: {
              status: "done",
              message: "Action denied by operator",
            },
          };
          return;
        }

        yield {
          type: "text_chunk",
          sessionId,
          timestamp: new Date().toISOString(),
          data: {
            text: `✅ **Action Authorized**: Operator approved execution of \`${detected.command || options.prompt}\`.\n\n`,
            delta: false,
          },
        };
      }
    }
    const effectiveOptions: CliRunOptions = {
      ...options,
      cwd: finalCwd,
      // Auto-approve in headless agy worker because operator permission was already resolved above
      dangerouslySkipPermissions: true,
    };

    let worker = this.workers.get(sessionId);

    // If config (model/effort/mode/cwd/permissions) changed, destroy old worker and respool with new configuration
    if (worker && worker.hasConfigChanged(effectiveOptions)) {
      worker.destroy();
      this.workers.delete(sessionId);
      worker = undefined;
    }

    // If no warm worker or previous process died, spawn a new one
    if (!worker || !worker.isRunning) {
      worker = new PersistentWorker(binary, effectiveOptions, sessionId, (w) => {
        if (this.workers.get(w.sessionId) === w) {
          this.workers.delete(w.sessionId);
        }
      });
      this.workers.set(sessionId, worker);

      yield {
        type: "status",
        sessionId,
        timestamp: new Date().toISOString(),
        data: { status: "starting", message: "Spooling warm Antigravity worker..." },
      };
    }

    yield* worker.executeTurn(options.prompt, options.attachments);
  }

  /**
   * Interrupts or kills a running CLI worker by sessionId.
   */
  cancel(sessionId: string): boolean {
    const pending = this.pendingApprovals.get(sessionId);
    if (pending) {
      pending.resolve(false);
      this.pendingApprovals.delete(sessionId);
    }
    const worker = this.workers.get(sessionId);
    if (worker) {
      worker.destroy();
      this.workers.delete(sessionId);
      return true;
    }
    return Boolean(pending);
  }

  /**
   * Dispatches permission decision to an active worker by sessionId.
   */
  respondPermission(sessionId: string, requestId: string, allow: boolean): boolean {
    let pending = this.pendingApprovals.get(sessionId);
    if (!pending && requestId) {
      for (const [sId, p] of this.pendingApprovals.entries()) {
        if (p.approvalId === requestId) {
          pending = p;
          this.pendingApprovals.delete(sId);
          break;
        }
      }
    } else if (pending) {
      this.pendingApprovals.delete(sessionId);
    }

    if (pending) {
      pending.resolve(allow);
      return true;
    }

    const worker = this.workers.get(sessionId);
    if (worker) {
      return worker.respondPermission(requestId, allow);
    }
    return false;
  }

  /**
   * Introspects and lists all active warm persistent CLI worker child processes.
   */
  async listWorkers(): Promise<CliWorkerInfo[]> {
    const results: CliWorkerInfo[] = [];
    const deadSessions: string[] = [];

    for (const [sessionId, worker] of this.workers.entries()) {
      if (typeof worker.isRunning === "boolean" && !worker.isRunning) {
        deadSessions.push(sessionId);
        continue;
      }

      let sessionTitle: string | undefined;
      let workspaceName: string | undefined;
      let workspacePath: string | undefined = worker.activeCwd;

      try {
        const brainSession = await getBrainSession(sessionId);
        if (brainSession) {
          sessionTitle = brainSession.title;
          workspaceName = (brainSession as any).workspaceName || (brainSession.workspacePath ? path.basename(brainSession.workspacePath) : undefined);
          if (brainSession.workspacePath) {
            workspacePath = brainSession.workspacePath;
          }
        }
      } catch {
        // ignore lookup failure
      }

      if (typeof (worker as any).getWorkerInfo === "function") {
        const info = (worker as any).getWorkerInfo(sessionTitle, workspaceName);
        if (workspacePath) info.workspacePath = workspacePath;
        results.push(info);
      } else {
        results.push({
          sessionId: worker.sessionId || sessionId,
          sessionTitle,
          workspacePath: workspacePath || worker.activeCwd,
          workspaceName,
          pid: worker.pid,
          isRunning: typeof worker.isRunning === "boolean" ? worker.isRunning : true,
          isBusy: Boolean(worker.isBusy),
          activeModel: worker.activeModel,
          activeEffort: worker.activeEffort,
          activeMode: worker.activeMode,
          activeCwd: worker.activeCwd,
          startedAt: (worker as any).startedAt || new Date().toISOString(),
          lastActiveAt: (worker as any).lastActiveAt || new Date().toISOString(),
        });
      }
    }

    for (const deadId of deadSessions) {
      const w = this.workers.get(deadId);
      if (w) {
        try { w.destroy(); } catch {}
      }
      this.workers.delete(deadId);
    }

    return results;
  }

  /**
   * Terminates a persistent CLI worker by sessionId.
   */
  killWorker(sessionId: string): boolean {
    const worker = this.workers.get(sessionId);
    if (!worker) {
      return false;
    }
    worker.destroy();
    this.workers.delete(sessionId);
    return true;
  }

  /**
   * Restarts a persistent worker child process by sessionId.
   */
  async restartWorker(sessionId: string): Promise<boolean> {
    const worker = this.workers.get(sessionId);
    if (!worker) {
      return false;
    }

    const savedOptions = (worker as any).options as CliRunOptions | undefined;
    worker.destroy();
    this.workers.delete(sessionId);

    if (savedOptions) {
      const binary = getAgyBinaryPath();
      if (binary) {
        try {
          const freshWorker = new PersistentWorker(binary, savedOptions, sessionId, (w) => {
            if (this.workers.get(w.sessionId) === w) {
              this.workers.delete(w.sessionId);
            }
          });
          this.workers.set(sessionId, freshWorker);
          return true;
        } catch {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Kills all persistent workers that are not actively running a turn.
   */
  killAllIdleWorkers(): number {
    let killedCount = 0;
    const targets: string[] = [];

    for (const [sessionId, worker] of this.workers.entries()) {
      if (!worker.isBusy) {
        targets.push(sessionId);
      }
    }

    for (const targetId of targets) {
      if (this.killWorker(targetId)) {
        killedCount++;
      }
    }

    return killedCount;
  }
}
