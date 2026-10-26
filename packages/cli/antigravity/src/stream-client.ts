import fs from "node:fs";
import path from "node:path";
import { spawn, execFile, type ChildProcess } from "node:child_process";
import { promisify } from "node:util";
import readline from "node:readline";
import crypto from "node:crypto";
import type { CliRunOptions, CliEvent } from "@cloud-agent/cli-interface";
import { getAgyBinaryPath, getBrainDir } from "./paths.js";
import { mapAntigravityStreamEvent } from "./mapper.js";
import { getBrainSession } from "./transcript-reader.js";

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

    if (!fs.existsSync(transcriptPath)) {
      return;
    }

    const content = fs.readFileSync(transcriptPath, "utf-8");
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

  hasConfigChanged(options: CliRunOptions): boolean {
    if (options.model && options.model !== this.activeModel) return true;
    if (options.effort && options.effort !== this.activeEffort) return true;
    if (options.mode && options.mode !== this.activeMode) return true;
    const targetSkip = options.dangerouslySkipPermissions !== false;
    if (targetSkip !== this.activeDangerouslySkipPermissions) return true;
    if (options.cwd) {
      const normTargetCwd = path.normalize(options.cwd).toLowerCase();
      if (this.activeCwd && normTargetCwd !== this.activeCwd) return true;
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

  async *executeTurn(prompt: string): AsyncIterable<CliEvent> {
    this.isTurnRunning = true;
    this.resetIdleTimer();

    // Clear queue of any stale items
    this.queue = [];

    // Write input turn payload to stdin in Antigravity NDJSON format
    try {
      const turnPayload =
        JSON.stringify({
          event: "user",
          message: { content: prompt },
        }) + "\n";

      this.child.stdin?.write(turnPayload);
    } catch (writeErr) {
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

export class AntigravityStreamClient {
  private workers = new Map<string, PersistentWorker>();

  /**
   * Runs an agent turn using a persistent session worker.
   * If a worker for this session already exists and is alive, reuses it immediately.
   * If not, spawns a warm worker that stays alive for subsequent turns.
   */
  async *run(options: CliRunOptions): AsyncIterable<CliEvent> {
    const binary = getAgyBinaryPath() || "agy";
    const sessionId = options.sessionId || crypto.randomUUID();

    // 1. Intercept CLI built-in utility commands (/help, /skills, /models, /mcp, /usage, etc.)
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
          cwd: options.cwd,
          env: { ...process.env, ...options.env },
        });

        let outputText = stdout || stderr || "Command executed with no output.";
        if (cmdConfig.stripAnsi) {
          outputText = cleanCliOutput(outputText);
        }

        // Persist to session transcript if an active session exists
        if (options.sessionId) {
          appendCommandToTranscript(options.sessionId, options.prompt, outputText);
        }

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
    let effectiveCwd = options.cwd;
    if (options.sessionId) {
      const isDaemonCwd =
        effectiveCwd &&
        path.normalize(effectiveCwd).toLowerCase() === path.normalize(process.cwd()).toLowerCase();
      if (!effectiveCwd || isDaemonCwd) {
        try {
          const sessDetail = await getBrainSession(options.sessionId);
          if (sessDetail?.workspacePath && sessDetail.workspacePath.trim() !== "") {
            effectiveCwd = sessDetail.workspacePath;
          }
        } catch {
          // ignore lookup failure
        }
      }
    }

    const effectiveOptions: CliRunOptions = {
      ...options,
      cwd: effectiveCwd || options.cwd || process.cwd(),
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

    yield* worker.executeTurn(options.prompt);
  }

  /**
   * Interrupts or kills a running CLI worker by sessionId.
   */
  cancel(sessionId: string): boolean {
    const worker = this.workers.get(sessionId);
    if (worker) {
      worker.destroy();
      this.workers.delete(sessionId);
      return true;
    }
    return false;
  }

  /**
   * Dispatches permission decision to an active worker by sessionId.
   */
  respondPermission(sessionId: string, requestId: string, allow: boolean): boolean {
    const worker = this.workers.get(sessionId);
    if (worker) {
      return worker.respondPermission(requestId, allow);
    }
    return false;
  }
}
