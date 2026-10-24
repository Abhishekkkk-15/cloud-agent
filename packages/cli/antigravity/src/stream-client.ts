import { spawn, type ChildProcess } from "node:child_process";
import readline from "node:readline";
import crypto from "node:crypto";
import type { CliRunOptions, CliEvent } from "@cloud-agent/cli-interface";
import { getAgyBinaryPath } from "./paths.js";
import { mapAntigravityStreamEvent } from "./mapper.js";

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

  constructor(
    binary: string,
    options: CliRunOptions,
    sessionId: string,
    private onExit: (worker: PersistentWorker) => void
  ) {
    this.sessionId = sessionId;

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
    if (options.dangerouslySkipPermissions !== false) {
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

    let worker = this.workers.get(sessionId);

    // If no warm worker or previous process died, spawn a new one
    if (!worker || !worker.isRunning) {
      worker = new PersistentWorker(binary, options, sessionId, (w) => {
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
}
