import { spawn, type ChildProcess } from "node:child_process";
import readline from "node:readline";
import crypto from "node:crypto";
import type { CliRunOptions, CliEvent } from "@cloud-agent/cli-interface";
import { getAgyBinaryPath } from "./paths.js";
import { mapAntigravityStreamEvent } from "./mapper.js";

export class AntigravityStreamClient {
  private activeProcesses = new Map<string, ChildProcess>();

  /**
   * Spawns an Antigravity CLI process in stream-json mode and streams normalized CliEvents.
   */
  async *run(options: CliRunOptions): AsyncIterable<CliEvent> {
    const binary = getAgyBinaryPath() || "agy";
    const sessionId = options.sessionId || crypto.randomUUID();

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

    const child = spawn(binary, args, {
      cwd: options.cwd,
      env,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });

    this.activeProcesses.set(sessionId, child);

    // Yield initial starting status
    yield {
      type: "status",
      sessionId,
      timestamp: new Date().toISOString(),
      data: { status: "starting", message: "Starting Antigravity CLI..." },
    };

    // Queue events from stdout/stderr/exit
    type QueueItem = { event?: CliEvent; error?: Error; done?: boolean };
    const queue: QueueItem[] = [];
    let resolveWait: (() => void) | null = null;

    function pushItem(item: QueueItem) {
      queue.push(item);
      if (resolveWait) {
        resolveWait();
        resolveWait = null;
      }
    }

    // Read stdout line by line
    const rlOut = readline.createInterface({
      input: child.stdout!,
      crlfDelay: Infinity,
    });

    rlOut.on("line", (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      try {
        const parsed = JSON.parse(trimmed) as Record<string, unknown>;
        const mappedEvents = mapAntigravityStreamEvent(sessionId, parsed);
        for (const ev of mappedEvents) {
          pushItem({ event: ev });
        }
      } catch {
        // Plain text fallback if line is not JSON
        pushItem({
          event: {
            type: "text_chunk",
            sessionId,
            timestamp: new Date().toISOString(),
            data: { text: trimmed + "\n", delta: true },
          },
        });
      }
    });

    // Read stderr line by line
    const rlErr = readline.createInterface({
      input: child.stderr!,
      crlfDelay: Infinity,
    });

    rlErr.on("line", (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      pushItem({
        event: {
          type: "status",
          sessionId,
          timestamp: new Date().toISOString(),
          data: { status: "thinking", message: trimmed },
        },
      });
    });

    child.on("error", (err: Error) => {
      pushItem({
        event: {
          type: "error",
          sessionId,
          timestamp: new Date().toISOString(),
          data: { error: err.message },
        },
      });
      pushItem({ done: true });
    });

    child.on("close", (code: number | null) => {
      this.activeProcesses.delete(sessionId);
      if (code !== 0 && code !== null) {
        pushItem({
          event: {
            type: "status",
            sessionId,
            timestamp: new Date().toISOString(),
            data: { status: "error", message: `Process exited with code ${code}` },
          },
        });
      } else {
        pushItem({
          event: {
            type: "status",
            sessionId,
            timestamp: new Date().toISOString(),
            data: { status: "done", message: "Turn completed" },
          },
        });
      }
      pushItem({ done: true });
    });

    // Write input turn payload to stdin in Antigravity NDJSON format
    try {
      const turnPayload =
        JSON.stringify({
          event: "user",
          message: { content: options.prompt },
        }) + "\n";
      child.stdin?.write(turnPayload);
      child.stdin?.end();
    } catch (writeErr) {
      pushItem({
        event: {
          type: "error",
          sessionId,
          timestamp: new Date().toISOString(),
          data: { error: `Failed to write to stdin: ${String(writeErr)}` },
        },
      });
      pushItem({ done: true });
    }

    // Async generator consumption loop
    try {
      while (true) {
        while (queue.length > 0) {
          const item = queue.shift()!;
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

        // Wait for next item
        await new Promise<void>((res) => {
          resolveWait = res;
        });
      }
    } finally {
      this.activeProcesses.delete(sessionId);
    }
  }

  /**
   * Interrupts or kills a running CLI process by sessionId.
   */
  cancel(sessionId: string): boolean {
    const proc = this.activeProcesses.get(sessionId);
    if (proc && !proc.killed) {
      try {
        proc.kill("SIGINT");
        setTimeout(() => {
          if (!proc.killed) {
            proc.kill("SIGTERM");
          }
        }, 1500);
        this.activeProcesses.delete(sessionId);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}
