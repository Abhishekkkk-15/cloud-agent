import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SessionStreamHub } from "../src/rpc/stream-hub.js";
import { rpcDispatcher } from "../src/rpc/index.js";
import type { CliEvent } from "@cloud-agent/cli-interface";

describe("@cloud-agent/daemon - Stream Hub & Agent State", () => {
  it("SessionStreamHub should broadcast events to active subscribers and buffer history", () => {
    const hub = new SessionStreamHub();
    const sessionId = "hub-test-sess-1";

    hub.startTurn(sessionId);
    assert.equal(hub.hasActiveTurn(sessionId), true);

    const receivedSub1: CliEvent[] = [];
    const receivedSub2: CliEvent[] = [];

    // Sub 1 subscribes before broadcasts
    const unsub1 = hub.subscribe(sessionId, (chunk) => {
      if (chunk.event) receivedSub1.push(chunk.event);
    });

    // Sub 2 subscribes before broadcasts
    const unsub2 = hub.subscribe(sessionId, (chunk) => {
      if (chunk.event) receivedSub2.push(chunk.event);
    });

    const event1: CliEvent = {
      type: "assistant.thought",
      sessionId,
      timestamp: new Date().toISOString(),
      data: { text: "Thinking about task" },
    };
    const event2: CliEvent = {
      type: "assistant.message",
      sessionId,
      timestamp: new Date().toISOString(),
      data: { text: "Hello user" },
    };

    hub.broadcast(sessionId, event1);
    hub.broadcast(sessionId, event2);

    assert.equal(receivedSub1.length, 2);
    assert.equal(receivedSub2.length, 2);
    assert.equal(receivedSub1[0].type, "assistant.thought");
    assert.equal(receivedSub1[1].type, "assistant.message");

    // Invariant: Buffer holds the broadcast events for late subscribers
    const buffered = hub.getBufferedEvents(sessionId);
    assert.equal(buffered.length, 2);
    assert.deepEqual(buffered, [event1, event2]);

    // Unsubscribe sub1 and verify it stops receiving
    unsub1();
    const event3: CliEvent = {
      type: "tool.start",
      sessionId,
      timestamp: new Date().toISOString(),
      data: { tool: "read_file" },
    };
    hub.broadcast(sessionId, event3);

    assert.equal(receivedSub1.length, 2, "Unsubscribed listener should not receive new event");
    assert.equal(receivedSub2.length, 3, "Active listener should continue receiving");

    unsub2();
  });

  it("SessionStreamHub should notify subscribers on endTurn with completion result", () => {
    const hub = new SessionStreamHub();
    const sessionId = "hub-test-sess-2";
    hub.startTurn(sessionId);

    let completionChunk: any = null;
    hub.subscribe(sessionId, (chunk) => {
      if (chunk.done) completionChunk = chunk;
    });

    const turnResult = { completed: true, isCommand: false, sessionId };
    hub.endTurn(sessionId, turnResult);

    assert.ok(completionChunk, "Subscriber should receive done chunk");
    assert.equal(completionChunk.done, true);
    assert.deepEqual(completionChunk.result, turnResult);
  });

  it("agent.status should require sessionId and report running state", async () => {
    const errRes = await rpcDispatcher.handle({
      id: "test-agent-status-no-id",
      method: "agent.status",
      params: {},
    });
    assert.ok(errRes.error, "Expected error on missing sessionId");
    assert.match(errRes.error!, /Missing sessionId/);

    const okRes = await rpcDispatcher.handle({
      id: "test-agent-status-ok",
      method: "agent.status",
      params: { sessionId: "idle-session-999" },
    });
    assert.equal(okRes.id, "test-agent-status-ok");
    assert.ok(okRes.result);
    const result = okRes.result as { sessionId: string; isRunning: boolean };
    assert.equal(result.sessionId, "idle-session-999");
    assert.equal(result.isRunning, false);
  });

  it("agent.subscribe should return isRunning: false if session is not active", async () => {
    const res = await rpcDispatcher.handle({
      id: "test-agent-sub-idle",
      method: "agent.subscribe",
      params: { sessionId: "not-running-session" },
    });

    assert.equal(res.id, "test-agent-sub-idle");
    assert.ok(res.result);
    const result = res.result as { sessionId: string; isRunning: boolean };
    assert.equal(result.sessionId, "not-running-session");
    assert.equal(result.isRunning, false);
  });

  it("agent.cancel and agent.approve should validate required parameters", async () => {
    const cancelErr = await rpcDispatcher.handle({
      id: "test-agent-cancel-err",
      method: "agent.cancel",
      params: {},
    });
    assert.ok(cancelErr.error, "Missing sessionId must fail for agent.cancel");

    const approveRes = await rpcDispatcher.handle({
      id: "test-agent-approve-call",
      method: "agent.approve",
      params: {
        sessionId: "mock-sess-1",
        requestId: "req-123",
        allow: true,
      },
    });
    assert.equal(approveRes.id, "test-agent-approve-call");
    assert.deepEqual(approveRes.result, { ok: true });
  });
});
