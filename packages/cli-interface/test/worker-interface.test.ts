import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BaseCliAdapter,
  type CliAvailability,
  type CliSessionSummary,
  type CliSessionDetail,
  type CliMessage,
  type CliPaginatedResult,
  type CliRunOptions,
  type CliEvent,
  type CliWorkerInfo,
} from "../src/index.js";

class DummyAdapter extends BaseCliAdapter {
  readonly id = "dummy";
  readonly displayName = "Dummy Adapter";
  readonly binaryName = "dummy";

  async checkAvailability(): Promise<CliAvailability> {
    return { available: true };
  }
  async listSessions(): Promise<CliPaginatedResult<CliSessionSummary>> {
    return { items: [], total: 0, hasMore: false, limit: 10, offset: 0 };
  }
  async getSession(): Promise<CliSessionDetail | null> {
    return null;
  }
  async getMessages(): Promise<CliPaginatedResult<CliMessage>> {
    return { items: [], total: 0, hasMore: false, limit: 10, offset: 0 };
  }
  async *run(): AsyncIterable<CliEvent> {}
  async cancel(): Promise<void> {}
}

describe("@cloud-agent/cli-interface - Worker Lifecycle Interface", () => {
  it("BaseCliAdapter should supply default worker management implementations", async () => {
    const adapter = new DummyAdapter();

    assert.equal(typeof adapter.listWorkers, "function", "listWorkers should be a function");
    assert.equal(typeof adapter.killWorker, "function", "killWorker should be a function");
    assert.equal(typeof adapter.restartWorker, "function", "restartWorker should be a function");
    assert.equal(typeof adapter.killAllIdleWorkers, "function", "killAllIdleWorkers should be a function");

    const workers = await adapter.listWorkers!();
    assert.deepEqual(workers, []);

    const killed = await adapter.killWorker!("sess-1");
    assert.equal(killed, false);

    const restarted = await adapter.restartWorker!("sess-1");
    assert.equal(restarted, false);

    const idleCount = await adapter.killAllIdleWorkers!();
    assert.equal(idleCount, 0);
  });

  it("CliWorkerInfo interface type verification", () => {
    const worker: CliWorkerInfo = {
      sessionId: "session-abc",
      sessionTitle: "Fix bug",
      workspacePath: "/repo/code",
      workspaceName: "code",
      pid: 12345,
      isRunning: true,
      isBusy: false,
      activeModel: "gemini-3.8-flash-high",
      activeEffort: "high",
      activeMode: "auto",
      activeCwd: "/repo/code",
      startedAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    };

    assert.equal(worker.sessionId, "session-abc");
    assert.equal(worker.isRunning, true);
    assert.equal(worker.isBusy, false);
    assert.equal(worker.pid, 12345);
  });
});
