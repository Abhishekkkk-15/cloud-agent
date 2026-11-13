import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AntigravityAdapter } from "../src/adapter.js";
import { AntigravityStreamClient } from "../src/stream-client.js";

describe("@cloud-agent/cli-antigravity - Worker Tracking & Management", () => {
  it("AntigravityAdapter should implement worker lifecycle methods", async () => {
    const adapter = new AntigravityAdapter();

    assert.equal(typeof adapter.listWorkers, "function", "listWorkers must be a function");
    assert.equal(typeof adapter.killWorker, "function", "killWorker must be a function");
    assert.equal(typeof adapter.restartWorker, "function", "restartWorker must be a function");
    assert.equal(typeof adapter.killAllIdleWorkers, "function", "killAllIdleWorkers must be a function");

    // Initially no workers should be spooled
    const workers = await adapter.listWorkers();
    assert.ok(Array.isArray(workers));
    assert.equal(workers.length, 0);

    // Killing/restarting a non-existent worker should return false
    const killed = await adapter.killWorker("non-existent-session");
    assert.equal(killed, false);

    const restarted = await adapter.restartWorker("non-existent-session");
    assert.equal(restarted, false);

    // Killing all idle workers when none are idle should return 0
    const idleCount = await adapter.killAllIdleWorkers();
    assert.equal(idleCount, 0);
  });

  it("AntigravityStreamClient should track and manage persistent worker instances", async () => {
    const client = new AntigravityStreamClient();

    // 1. Initially empty
    const initialWorkers = await client.listWorkers();
    assert.deepEqual(initialWorkers, []);

    // 2. Inject mock worker into private workers map for testing lifecycle invariants
    const mockSessionId = "test-session-123";
    let destroyed = false;

    const mockWorker: any = {
      sessionId: mockSessionId,
      pid: 99999,
      isRunning: true,
      isBusy: false,
      activeModel: "gemini-3.8-flash-high",
      activeEffort: "high",
      activeMode: "auto",
      activeCwd: "/test/workspace",
      startedAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      destroy: () => {
        destroyed = true;
      },
    };

    (client as any).workers.set(mockSessionId, mockWorker);

    // Verify listWorkers introspects the worker
    const listed = await client.listWorkers();
    assert.equal(listed.length, 1);
    assert.equal(listed[0].sessionId, mockSessionId);
    assert.equal(listed[0].pid, 99999);
    assert.equal(listed[0].isRunning, true);
    assert.equal(listed[0].isBusy, false);
    assert.equal(listed[0].activeModel, "gemini-3.8-flash-high");

    // 3. killWorker removes and calls destroy
    const killResult = client.killWorker(mockSessionId);
    assert.equal(killResult, true);
    assert.equal(destroyed, true);
    assert.equal((client as any).workers.has(mockSessionId), false);

    // 4. killAllIdleWorkers only kills idle workers, leaving busy workers alone
    const busySession = "busy-session-456";
    const idleSession = "idle-session-789";
    let busyDestroyed = false;
    let idleDestroyed = false;

    const busyWorker: any = {
      sessionId: busySession,
      pid: 11111,
      isRunning: true,
      isBusy: true,
      startedAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      destroy: () => { busyDestroyed = true; },
    };

    const idleWorker: any = {
      sessionId: idleSession,
      pid: 22222,
      isRunning: true,
      isBusy: false,
      startedAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      destroy: () => { idleDestroyed = true; },
    };

    (client as any).workers.set(busySession, busyWorker);
    (client as any).workers.set(idleSession, idleWorker);

    const killedCount = client.killAllIdleWorkers();
    assert.equal(killedCount, 1, "Should kill exactly 1 idle worker");
    assert.equal(idleDestroyed, true, "Idle worker should be destroyed");
    assert.equal(busyDestroyed, false, "Busy worker should NOT be destroyed");
    assert.equal((client as any).workers.has(busySession), true, "Busy worker remains active");
    assert.equal((client as any).workers.has(idleSession), false, "Idle worker was removed");

    // Clean up
    client.cancel(busySession);
  });
});
