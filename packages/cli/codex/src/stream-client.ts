import fs from "node:fs";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import readline from "node:readline";
import crypto from "node:crypto";
import type {
  CliRunOptions,
  CliEvent,
  CliWorkerInfo,
} from "@cloud-agent/cli-interface";
import { getCodexBinaryPath } from "./paths.js";
import { mapCodexStreamEvent } from "./mapper.js";

type QueueItem = { event?: CliEvent; error?: Error; done?: boolean };

class CodexWorker {
  readonly sessionId: string;
  readonly options: CliRunOptions;
  readonly startedAt: string = new Date().toISOString();
  lastActiveAt: string = new Date().toISOString();
  private child: ChildProcess;
  private isAlive = true;
  private queue: QueueItem[] = [];
  private resolveWait: (() => void) | null = null;
  private isTurnRunning = false;
  readonly activeModel?: string;
  readonly activeEffort?: string;
  readonly activeMode?: string;
  readonly activeCwd?: string;

  constructor(
    binary: string,
    options: CliRunOptions,
    sessionId: string,
    private onExit: (worker: CodexWorker) => void
  ) {
    this.sessionId = sessionId;
    this.options = options;
    this.activeModel = options.model;
    this.activeEffort = options.effort;
    this.activeMode = options.mode;
    this.activeCwd = options.cwd ? path.normalize(options.cwd).toLowerCase() : undefined;

    const args: string[] = ["exec"];

    // Resume existing session if ID provided
    if (options.sessionId) {
      args.push("resume", options.sessionId);
    }

    // Pass prompt
    args.push(options.prompt);

    // Stream output as JSONL
    args.push("--json");

    // Working directory
    if (options.cwd) {
      args.push("-C", options.cwd);
    }

    // Model override
    if (options.model) {
      args.push("-m", options.model);
    }

    // Reasoning effort override
    if (options.effort) {
      args.push("-c", `model_reasoning_effort="${options.effort}"`);
    }

    // Sandbox mode
    if (options.mode === "plan") {
      args.push("-s", "read-only");
    } else {
      args.push("-s", "workspace-write");
    }

    // Non-interactive headless execution bypass
    if (options.dangerouslySkipPermissions !== false) {
      args.push("--dangerously-bypass-approvals-and-sandbox");
    }

    // Native image attachments
    if (options.attachments && options.attachments.length > 0) {
      for (const att of options.attachments) {
        if (att.path && fs.existsSync(att.path)) {
          args.push("-i", att.path);
        }
      }
    }

    const env = {
      ...process.env,
      ...options.env,
    };

    let spawnBin = binary;
    let spawnArgs = args;

    if (process.platform === "win32" && binary.endsWith(".cmd")) {
      spawnBin = "cmd.exe";
      spawnArgs = ["/d", "/s", "/c", binary, ...args];
    }

    console.log(`[CodexWorker] Spawning: ${spawnBin} ${spawnArgs.slice(0, 6).join(" ")} ...`);

    this.child = spawn(spawnBin, spawnArgs, {
      cwd: options.cwd,
      env,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });

    // Close stdin immediately so codex exec does not wait for piped stdin input
    if (this.child.stdin) {
      this.child.stdin.end();
    }

    this.setupListeners();
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

  private setupListeners(): void {
    if (!this.child.stdout) return;

    let stderrBuffer = "";
    if (this.child.stderr) {
      this.child.stderr.on("data", (chunk: Buffer | string) => {
        stderrBuffer += chunk.toString();
      });
    }

    const rl = readline.createInterface({
      input: this.child.stdout,
      crlfDelay: Infinity,
    });

    this.isTurnRunning = true;

    rl.on("line", (line: string) => {
      this.lastActiveAt = new Date().toISOString();
      const { events } = mapCodexStreamEvent(line, this.sessionId);
      for (const ev of events) {
        this.pushQueue({ event: ev });
      }
    });

    this.child.on("error", (err: Error) => {
      console.error(`[CodexWorker] Child process error:`, err);
      this.pushQueue({ error: err });
      this.cleanup();
    });

    this.child.on("exit", (code: number | null, signal: string | null) => {
      this.lastActiveAt = new Date().toISOString();
      this.isTurnRunning = false;
      this.isAlive = false;

      if (code !== 0 && code !== null) {
        const errorMsg = stderrBuffer.trim() || `Codex process exited with code ${code}`;
        console.warn(`[CodexWorker] Session ${this.sessionId} exited non-zero (${code}): ${errorMsg}`);
      }

      this.pushQueue({ done: true });
      this.cleanup();
    });
  }

  private pushQueue(item: QueueItem): void {
    this.queue.push(item);
    if (this.resolveWait) {
      const fn = this.resolveWait;
      this.resolveWait = null;
      fn();
    }
  }

  async *streamEvents(): AsyncIterable<CliEvent> {
    while (true) {
      while (this.queue.length > 0) {
        const item = this.queue.shift()!;
        if (item.error) {
          throw item.error;
        }
        if (item.done) {
          return;
        }
        if (item.event) {
          yield item.event;
        }
      }

      if (!this.isAlive && this.queue.length === 0) {
        return;
      }

      await new Promise<void>((resolve) => {
        this.resolveWait = resolve;
      });
    }
  }

  kill(): void {
    this.isAlive = false;
    this.isTurnRunning = false;
    try {
      this.child.kill();
    } catch {
      // ignore
    }
    this.cleanup();
  }

  private cleanup(): void {
    this.isAlive = false;
    this.isTurnRunning = false;
    this.onExit(this);
  }
}

/**
 * Manages streaming turns and processes for OpenAI Codex CLI.
 */
export class CodexStreamClient {
  private workers = new Map<string, CodexWorker>();

  /**
   * Runs an instruction turn or starts a new session using `codex exec`.
   */
  async *run(options: CliRunOptions): AsyncIterable<CliEvent> {
    const binary = getCodexBinaryPath();
    if (!binary) {
      throw new Error("Codex CLI executable not found on host system.");
    }

    const sessionId = options.sessionId || crypto.randomUUID();

    // Kill any existing running turn for this session
    if (this.workers.has(sessionId)) {
      const existing = this.workers.get(sessionId)!;
      existing.kill();
      this.workers.delete(sessionId);
    }

    const worker = new CodexWorker(
      binary,
      options,
      sessionId,
      (w) => {
        if (this.workers.get(sessionId) === w) {
          this.workers.delete(sessionId);
        }
      }
    );

    this.workers.set(sessionId, worker);

    yield* worker.streamEvents();
  }

  /**
   * Cancels a running agent turn.
   */
  cancel(sessionId: string): void {
    const worker = this.workers.get(sessionId);
    if (worker) {
      console.log(`[CodexStreamClient] Cancelling turn for session ${sessionId}`);
      worker.kill();
      this.workers.delete(sessionId);
    }
  }

  isTurnRunning(sessionId: string): boolean {
    const worker = this.workers.get(sessionId);
    return worker ? worker.isBusy : false;
  }

  listWorkers(): CliWorkerInfo[] {
    return Array.from(this.workers.values()).map((w) => w.getWorkerInfo());
  }

  killWorker(sessionId: string): boolean {
    const worker = this.workers.get(sessionId);
    if (!worker) return false;
    worker.kill();
    this.workers.delete(sessionId);
    return true;
  }

  restartWorker(sessionId: string): boolean {
    const worker = this.workers.get(sessionId);
    if (!worker) return false;
    worker.kill();
    this.workers.delete(sessionId);
    return true;
  }

  killAllIdleWorkers(): number {
    let killed = 0;
    for (const [id, worker] of this.workers.entries()) {
      if (!worker.isBusy) {
        worker.kill();
        this.workers.delete(id);
        killed++;
      }
    }
    return killed;
  }
}
