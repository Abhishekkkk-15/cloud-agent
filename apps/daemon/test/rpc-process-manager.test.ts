import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { rpcDispatcher } from "../src/rpc/index.js";
import { getLogFilePath } from "../src/logger.js";
import { sessionStreamHub } from "../src/rpc/stream-hub.js";

describe("@cloud-agent/daemon - RPC Process Manager Handlers", () => {
  it("rpcDispatcher should handle daemon.workers", async () => {
    const res = await rpcDispatcher.handle({
      id: "req-workers-1",
      method: "daemon.workers",
    });

    assert.equal(res.id, "req-workers-1");
    assert.ok(res.result, "Expected result on daemon.workers");
    const body = res.result as any;
    assert.ok(Array.isArray(body.workers), "Expected workers array");
  });

  it("rpcDispatcher should handle daemon.kill_worker and clean up active turn stream", async () => {
    const testSession = "test-kill-turn-session";
    const registry = (await import("../src/registry.js")).registry;
    const adapter = registry.get("antigravity");
    if (adapter && (adapter as any).client) {
      (adapter as any).client.workers.set(testSession, {
        sessionId: testSession,
        pid: 8888,
        isRunning: true,
        isBusy: true,
        destroy: () => {},
      });
    }

    // Simulate an active turn in sessionStreamHub (addresses Review Focus 1)
    let receivedDone = false;
    const unsub = sessionStreamHub.subscribe(testSession, (chunk) => {
      if (chunk.done) {
        receivedDone = true;
      }
    });

    // Send synthetic event to seed buffer
    sessionStreamHub.broadcast(testSession, {
      type: "status",
      sessionId: testSession,
      timestamp: new Date().toISOString(),
      data: { status: "thinking", message: "Running heavy prompt..." },
    });

    const res = await rpcDispatcher.handle({
      id: "req-kill-1",
      method: "daemon.kill_worker",
      params: { sessionId: testSession },
    });

    assert.equal(res.id, "req-kill-1");
    assert.ok(res.result, "Expected kill result");
    const result = res.result as any;
    assert.equal(result.ok, true);
    assert.equal(result.killed, true);
    assert.equal(result.sessionId, testSession);
    assert.equal(receivedDone, true, "sessionStreamHub should have received done signal on worker kill");

    unsub();
  });

  it("rpcDispatcher should NOT pollute stream hub when killing an idle session with no active turn", async () => {
    const idleSession = "test-idle-worker-clean";
    const res = await rpcDispatcher.handle({
      id: "req-kill-idle-pollute",
      method: "daemon.kill_worker",
      params: { sessionId: idleSession },
    });

    assert.equal(res.id, "req-kill-idle-pollute");
    const result = res.result as any;
    assert.equal(result.ok, false);
    assert.equal(sessionStreamHub.hasActiveTurn(idleSession), false, "Idle worker kill should not create active turn in stream hub");
  });

  it("rpcDispatcher should handle daemon.kill_all_workers", async () => {
    const res = await rpcDispatcher.handle({
      id: "req-kill-idle-1",
      method: "daemon.kill_all_workers",
    });

    assert.equal(res.id, "req-kill-idle-1");
    assert.ok(res.result, "Expected kill all idle result");
    const result = res.result as any;
    assert.equal(typeof result.count, "number");
  });

  it("rpcDispatcher should handle daemon.logs gracefully even if log file is missing or empty", async () => {
    // Addresses Review Focus 3
    const res = await rpcDispatcher.handle({
      id: "req-logs-1",
      method: "daemon.logs",
      params: { lines: 25 },
    });

    assert.equal(res.id, "req-logs-1");
    assert.ok(res.result, "Expected logs result");
    const result = res.result as any;
    assert.ok(Array.isArray(result.lines), "Expected lines array");
    assert.ok(result.path, "Expected log file path");
  });

  it("rpcDispatcher should handle daemon.restart and return ok without throwing", async () => {
    const res = await rpcDispatcher.handle({
      id: "req-restart-1",
      method: "daemon.restart",
      params: { testDryRun: true },
    });

    assert.equal(res.id, "req-restart-1");
    assert.ok(res.result, "Expected restart result");
    const result = res.result as any;
    assert.equal(result.ok, true);
    assert.ok(result.message);
  });
});
