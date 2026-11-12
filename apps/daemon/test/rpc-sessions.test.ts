import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { rpcDispatcher } from "../src/rpc/index.js";

describe("@cloud-agent/daemon - Session Operations & Lifecycle", () => {
  const originalEnvDataDir = process.env.ANTIGRAVITY_DATA_DIR;
  const tmpBase = path.join(os.tmpdir(), `ca-daemon-session-test-${Date.now()}`);
  const brainDir = path.join(tmpBase, "brain");
  const testSessionId = "test-session-uuid-1234";
  const sessionDir = path.join(brainDir, testSessionId);

  before(() => {
    process.env.ANTIGRAVITY_DATA_DIR = tmpBase;

    // Create session structure
    const logsDir = path.join(sessionDir, ".system_generated", "logs");
    fs.mkdirSync(logsDir, { recursive: true });

    // Write mock transcript.jsonl
    const transcriptLines = [
      JSON.stringify({
        step_index: 0,
        type: "USER_INPUT",
        content: "<USER_REQUEST>Build a landing page for our app</USER_REQUEST>\nActive Workspaces:\n- " + tmpBase,
        created_at: "2026-11-12T10:00:00.000Z",
      }),
      JSON.stringify({
        step_index: 1,
        type: "PLANNER_RESPONSE",
        content: "I will start by drafting the architecture.",
        thinking: "Let's first analyze the project structure.",
        tool_calls: [
          {
            name: "write_file",
            args: { Path: path.join(tmpBase, "index.html"), Content: "<h1>Landing</h1>" },
          },
        ],
        created_at: "2026-11-12T10:00:05.000Z",
      }),
      JSON.stringify({
        step_index: 2,
        type: "GENERIC",
        content: "File written successfully.",
        created_at: "2026-11-12T10:00:06.000Z",
      }),
    ];
    fs.writeFileSync(path.join(logsDir, "transcript.jsonl"), transcriptLines.join("\n"), "utf8");

    // Write an artifact
    fs.writeFileSync(path.join(sessionDir, "architecture.md"), "# Architecture Doc", "utf8");
    fs.writeFileSync(
      path.join(sessionDir, "architecture.md.metadata.json"),
      JSON.stringify({ summary: "Overview of frontend and backend design" }),
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
      // ignore cleanup errors on temp dir
    }
  });

  it("sessions.get should return session details, extracted title, messages, and artifacts", async () => {
    const res = await rpcDispatcher.handle({
      id: "test-sess-get-1",
      method: "sessions.get",
      params: { sessionId: testSessionId, limit: 10, offset: 0, order: "asc", includeArtifacts: true },
    });

    assert.equal(res.id, "test-sess-get-1");
    assert.ok(res.result, "Expected session detail result");
    const detail = res.result as any;

    assert.equal(detail.id, testSessionId);
    assert.equal(detail.title, "Build a landing page for our app");
    assert.ok(Array.isArray(detail.messages));
    assert.equal(detail.messages.length, 3);
    assert.equal(detail.totalMessages, 3);
    assert.equal(detail.hasMoreMessages, false);

    // Verify chronological parsed message roles and content
    assert.equal(detail.messages[0].role, "user");
    assert.equal(detail.messages[0].content, "Build a landing page for our app");
    assert.equal(detail.messages[1].role, "assistant");
    assert.equal(detail.messages[1].reasoning, "Let's first analyze the project structure.");
    assert.ok(detail.messages[1].toolCalls?.length > 0);
    assert.equal(detail.messages[2].role, "tool");

    // Verify artifact discovery
    assert.ok(Array.isArray(detail.artifacts));
    assert.equal(detail.artifacts.length, 1);
    assert.equal(detail.artifacts[0].id, "architecture.md");
    assert.equal(detail.artifacts[0].summary, "Overview of frontend and backend design");
  });

  it("sessions.get should return error if sessionId parameter is missing", async () => {
    const res = await rpcDispatcher.handle({
      id: "test-sess-get-err",
      method: "sessions.get",
      params: {},
    });

    assert.ok(res.error, "Expected error when sessionId is missing");
    assert.match(res.error!, /Missing sessionId/);
  });

  it("sessions.messages should paginate messages slice", async () => {
    // Request page 1: limit 1, offset 0
    const page1Res = await rpcDispatcher.handle({
      id: "test-sess-msg-page1",
      method: "sessions.messages",
      params: { sessionId: testSessionId, limit: 1, offset: 0 },
    });

    assert.equal(page1Res.id, "test-sess-msg-page1");
    const page1 = page1Res.result as any;
    assert.equal(page1.items.length, 1);
    assert.equal(page1.total, 3);
    assert.equal(page1.hasMore, true);
    assert.equal(page1.items[0].role, "user");

    // Request page 2: limit 1, offset 1
    const page2Res = await rpcDispatcher.handle({
      id: "test-sess-msg-page2",
      method: "sessions.messages",
      params: { sessionId: testSessionId, limit: 1, offset: 1 },
    });

    const page2 = page2Res.result as any;
    assert.equal(page2.items.length, 1);
    assert.equal(page2.total, 3);
    assert.equal(page2.hasMore, true);
    assert.equal(page2.items[0].role, "assistant");
  });

  it("sessions.pin should set pinned state in meta.json and reflect in session detail", async () => {
    const pinRes = await rpcDispatcher.handle({
      id: "test-sess-pin-1",
      method: "sessions.pin",
      params: { sessionId: testSessionId, pinned: true },
    });

    assert.equal(pinRes.id, "test-sess-pin-1");
    assert.deepEqual(pinRes.result, { ok: true });

    // Verify detail reflects pinned state
    const detailRes = await rpcDispatcher.handle({
      id: "test-sess-pin-verify",
      method: "sessions.get",
      params: { sessionId: testSessionId },
    });
    assert.equal((detailRes.result as any)?.pinned, true);

    // Unpin
    const unpinRes = await rpcDispatcher.handle({
      id: "test-sess-unpin-1",
      method: "sessions.pin",
      params: { sessionId: testSessionId, pinned: false },
    });
    assert.deepEqual(unpinRes.result, { ok: true });
  });

  it("sessions.rename should update custom title in meta.json", async () => {
    const newTitle = "My Custom Renamed Session";
    const renameRes = await rpcDispatcher.handle({
      id: "test-sess-rename-1",
      method: "sessions.rename",
      params: { sessionId: testSessionId, title: newTitle },
    });

    assert.equal(renameRes.id, "test-sess-rename-1");
    assert.deepEqual(renameRes.result, { ok: true });

    // Verify detail reflects new custom title
    const detailRes = await rpcDispatcher.handle({
      id: "test-sess-rename-verify",
      method: "sessions.get",
      params: { sessionId: testSessionId },
    });
    assert.equal((detailRes.result as any)?.title, newTitle);
  });

  it("sessions.rename, pin, and delete should validate required parameters", async () => {
    const renameErr = await rpcDispatcher.handle({
      id: "test-err-rename",
      method: "sessions.rename",
      params: { sessionId: testSessionId }, // missing title
    });
    assert.ok(renameErr.error, "Expected error on missing title");

    const pinErr = await rpcDispatcher.handle({
      id: "test-err-pin",
      method: "sessions.pin",
      params: { sessionId: testSessionId }, // missing pinned
    });
    assert.ok(pinErr.error, "Expected error on missing pinned");

    const delErr = await rpcDispatcher.handle({
      id: "test-err-del",
      method: "sessions.delete",
      params: {}, // missing sessionId
    });
    assert.ok(delErr.error, "Expected error on missing sessionId");
  });

  it("sessions.delete should delete session directory from disk", async () => {
    assert.ok(fs.existsSync(sessionDir), "Session dir must exist before deletion");

    const delRes = await rpcDispatcher.handle({
      id: "test-sess-del-1",
      method: "sessions.delete",
      params: { sessionId: testSessionId },
    });

    assert.equal(delRes.id, "test-sess-del-1");
    assert.deepEqual(delRes.result, { ok: true });
    assert.ok(!fs.existsSync(sessionDir), "Session dir must be removed from disk");

    // Getting deleted session should return null
    const getRes = await rpcDispatcher.handle({
      id: "test-sess-del-verify",
      method: "sessions.get",
      params: { sessionId: testSessionId },
    });
    assert.equal(getRes.result, null);
  });
});
