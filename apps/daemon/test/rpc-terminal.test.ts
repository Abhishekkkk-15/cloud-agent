import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { rpcDispatcher } from "../src/rpc/index.js";

describe("@cloud-agent/daemon - Terminal Execution & Process Lifecycle", () => {
  it("terminal.exec should validate required command parameter", async () => {
    const res = await rpcDispatcher.handle({
      id: "test-term-no-cmd",
      method: "terminal.exec",
      params: {},
    });

    assert.ok(res.error, "Expected error on missing command param");
    assert.match(res.error!, /Missing or invalid command parameter/);
  });

  it("terminal.exec should execute a command and stream stdout chunks", async () => {
    const stdoutChunks: string[] = [];

    const res = await rpcDispatcher.handle(
      {
        id: "test-term-stdout",
        method: "terminal.exec",
        params: {
          command: 'node -e "console.log(\'automated-terminal-test-output\')"',
        },
      },
      (chunk) => {
        if (chunk.event?.data?.text) {
          stdoutChunks.push(chunk.event.data.text);
        }
      }
    );

    assert.equal(res.id, "test-term-stdout");
    assert.ok(res.result, "Expected result");
    const result = res.result as { exitCode: number; durationMs: number };
    assert.equal(result.exitCode, 0);
    assert.equal(typeof result.durationMs, "number");

    const fullStdout = stdoutChunks.join("");
    assert.match(fullStdout, /automated-terminal-test-output/);
  });

  it("terminal.exec should capture stderr chunks and non-zero exit codes", async () => {
    const stderrChunks: string[] = [];

    const res = await rpcDispatcher.handle(
      {
        id: "test-term-stderr",
        method: "terminal.exec",
        params: {
          command: 'node -e "console.error(\'failure-on-stderr\'); process.exit(7);"',
        },
      },
      (chunk) => {
        if (chunk.event?.data?.stream === "stderr") {
          stderrChunks.push(chunk.event.data.text);
        }
      }
    );

    assert.equal(res.id, "test-term-stderr");
    const result = res.result as { exitCode: number; durationMs: number };
    assert.equal(result.exitCode, 7);

    const fullStderr = stderrChunks.join("");
    assert.match(fullStderr, /failure-on-stderr/);
  });

  it("terminal.kill should terminate an active long-running process", async () => {
    const termId = "long-running-proc-1";

    // Launch a background node process that keeps running
    const execPromise = rpcDispatcher.handle({
      id: termId,
      method: "terminal.exec",
      params: {
        command: 'node -e "setInterval(() => {}, 1000)"',
      },
    });

    // Give process 200ms to spawn and register in activeTerminalProcesses
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Kill the process
    const killRes = await rpcDispatcher.handle({
      id: "test-term-kill-call",
      method: "terminal.kill",
      params: { targetId: termId },
    });

    assert.equal(killRes.id, "test-term-kill-call");
    assert.ok(killRes.result);
    const killResult = killRes.result as { killed: boolean; targetId: string };
    assert.equal(killResult.killed, true);
    assert.equal(killResult.targetId, termId);

    // Ensure execPromise resolves after kill
    const execRes = await execPromise;
    assert.equal(execRes.id, termId);
  });

  it("terminal.kill should return killed: false when targetId does not exist", async () => {
    const res = await rpcDispatcher.handle({
      id: "test-term-kill-missing",
      method: "terminal.kill",
      params: { targetId: "nonexistent-id-999" },
    });

    assert.equal(res.id, "test-term-kill-missing");
    const result = res.result as { killed: boolean; message: string };
    assert.equal(result.killed, false);
    assert.match(result.message, /not found or already exited/);
  });
});
