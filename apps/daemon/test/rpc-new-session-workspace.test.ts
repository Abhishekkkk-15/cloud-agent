import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { rpcDispatcher } from "../src/rpc/index.js";

function readSessionMeta(sessionDir: string): { customTitle?: string; pinned?: boolean; workspacePath?: string } | null {
  const metaPath = path.join(sessionDir, "meta.json");
  if (!fs.existsSync(metaPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(metaPath, "utf8"));
  } catch {
    return null;
  }
}

describe("@cloud-agent/daemon - Existing Workspace New Session Invariant", () => {
  const originalEnvDataDir = process.env.ANTIGRAVITY_DATA_DIR;
  const tmpBase = path.join(os.tmpdir(), `ca-workspace-test-${Date.now()}`);
  const brainDir = path.join(tmpBase, "brain");
  const existingWorkspace = path.join(tmpBase, "workspaces", "my-existing-project");

  before(() => {
    process.env.ANTIGRAVITY_DATA_DIR = tmpBase;
    fs.mkdirSync(brainDir, { recursive: true });
    fs.mkdirSync(existingWorkspace, { recursive: true });

    // Seed mock package.json so it is recognized as a valid project workspace
    fs.writeFileSync(
      path.join(existingWorkspace, "package.json"),
      JSON.stringify({ name: "my-existing-project", version: "1.0.0" }),
      "utf8"
    );
  });

  after(() => {
    if (originalEnvDataDir !== undefined) {
      process.env.ANTIGRAVITY_DATA_DIR = originalEnvDataDir;
    } else {
      delete process.env.ANTIGRAVITY_DATA_DIR;
    }
    try {
      fs.rmSync(tmpBase, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("starting a new session with an existing workspace should assign a unique UUID and record workspacePath", async () => {
    const streamedChunks: any[] = [];
    const runRes = await rpcDispatcher.handle(
      {
        id: "req-agent-run-new-sess",
        method: "agent.run",
        params: {
          prompt: "/models", // Builtin command triggers real execution in existingWorkspace
          cwd: existingWorkspace,
        },
      },
      (chunk) => {
        streamedChunks.push(chunk);
      }
    );

    assert.equal(runRes.id, "req-agent-run-new-sess");
    assert.ok(runRes.result, "Expected run result");
    const result = runRes.result as { completed: boolean; sessionId: string; isCommand: boolean };

    // Invariant 1: Must NOT be "default"
    assert.ok(result.sessionId, "Must return a valid sessionId");
    assert.notEqual(result.sessionId, "default", "Session ID must be a unique UUID, never 'default'");
    assert.equal(result.completed, true);

    // Invariant 2: meta.json in brain/<sessionId> must strictly record existingWorkspace
    const sessionDir = path.join(brainDir, result.sessionId);
    assert.ok(fs.existsSync(sessionDir), "Session directory must exist in brain");

    const meta = readSessionMeta(sessionDir);
    assert.ok(meta, "meta.json must exist");
    assert.equal(
      path.normalize(meta.workspacePath || "").toLowerCase(),
      path.normalize(existingWorkspace).toLowerCase(),
      "meta.json must record the exact existing workspace path, never home dir or daemon cwd"
    );

    // Invariant 3: sessions.get returns matching workspacePath
    const getRes = await rpcDispatcher.handle({
      id: "req-sess-get-1",
      method: "sessions.get",
      params: { sessionId: result.sessionId },
    });

    assert.ok(getRes.result, "Expected session get result");
    const sessionDetail = getRes.result as any;
    assert.equal(
      path.normalize(sessionDetail.workspacePath).toLowerCase(),
      path.normalize(existingWorkspace).toLowerCase(),
      "sessions.get must return the existing workspace path"
    );
  });

  it("subsequent turns in the session should maintain existing workspace even if cwd is omitted", async () => {
    // 1. Create a session in existing workspace
    const firstTurn = await rpcDispatcher.handle(
      {
        id: "req-turn-1",
        method: "agent.run",
        params: {
          prompt: "/models",
          cwd: existingWorkspace,
        },
      },
      () => {}
    );
    const sessionId = (firstTurn.result as any).sessionId;
    assert.ok(sessionId);

    // 2. Second turn: caller omits cwd (standard mobile follow-up prompt)
    const secondTurn = await rpcDispatcher.handle(
      {
        id: "req-turn-2",
        method: "agent.run",
        params: {
          prompt: "/models",
          sessionId, // pass existing sessionId, omit cwd
        },
      },
      () => {}
    );

    assert.ok(secondTurn.result, "Expected turn 2 result");
    const sessionDir = path.join(brainDir, sessionId);
    const meta = readSessionMeta(sessionDir);
    assert.equal(
      path.normalize(meta?.workspacePath || "").toLowerCase(),
      path.normalize(existingWorkspace).toLowerCase(),
      "Subsequent turn must retain existing workspace from session meta without regressing to home directory"
    );
  });

  it("workspaces.list should include the existing workspace and prioritize it over raw home directory", async () => {
    const listRes = await rpcDispatcher.handle({
      id: "req-ws-list-check",
      method: "workspaces.list",
    });

    assert.ok(listRes.result, "Expected workspaces.list result");
    const body = listRes.result as { workspaces: Array<{ path: string; name: string }> };
    assert.ok(Array.isArray(body.workspaces));

    const found = body.workspaces.find(
      (w) => path.normalize(w.path).toLowerCase() === path.normalize(existingWorkspace).toLowerCase()
    );
    assert.ok(found, "workspaces.list must include the existing workspace");
    assert.equal(found.name, "my-existing-project");

    // Invariant: Raw user home directory without project indicators should not precede real project workspaces
    const homeDir = os.homedir();
    const isFirstHome =
      body.workspaces.length > 0 &&
      path.normalize(body.workspaces[0].path).toLowerCase() === path.normalize(homeDir).toLowerCase();
    assert.equal(isFirstHome, false, "Raw home directory must not be prioritized as workspace #0");
  });
});
