import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { rpcDispatcher } from "../src/rpc/index.js";

describe("@cloud-agent/daemon - RPC Capabilities & Core Handlers", () => {
  it("rpcDispatcher should handle daemon.status and bundle capabilities", async () => {
    const res = await rpcDispatcher.handle({
      id: "test-status-1",
      method: "daemon.status",
    });

    assert.equal(res.id, "test-status-1");
    assert.ok(res.result, "Expected status result");
    const status = res.result as any;

    assert.ok(status.hostname, "Expected hostname");
    assert.ok(status.platform, "Expected platform");
    assert.ok(status.telemetry, "Expected telemetry");
    assert.ok(Array.isArray(status.adapters), "Expected adapters array");

    // Capabilities bundling invariant
    assert.ok(status.capabilities, "Expected bundled capabilities in daemon.status");
    assert.equal(status.capabilities.cliId, "antigravity");
    assert.ok(Array.isArray(status.capabilities.supportedModes));
    assert.equal(status.capabilities.supportsEffort, true);
    assert.equal(status.capabilities.permissions.requiresBypassInHeadless, true);
  });

  it("rpcDispatcher should handle cli.capabilities method", async () => {
    const res = await rpcDispatcher.handle({
      id: "test-cap-1",
      method: "cli.capabilities",
    });

    assert.equal(res.id, "test-cap-1");
    assert.ok(res.result, "Expected capabilities result");
    const caps = res.result as any;

    assert.equal(caps.cliId, "antigravity");
    assert.equal(caps.displayName, "Google Antigravity");
    assert.ok(caps.supportedModes.includes("auto"));
    assert.ok(caps.supportedModes.includes("plan"));
    assert.ok(caps.supportedModes.includes("accept-edits"));
    assert.equal(caps.defaultMode, "auto");
    assert.equal(caps.supportsEffort, true);
    assert.ok(caps.supportedEffortLevels.includes("high"));
    assert.equal(caps.permissions.requiresBypassInHeadless, true);
    assert.equal(caps.permissions.supportsHeadlessHitl, false);
    assert.equal(caps.permissions.bypassFlagName, "--dangerously-skip-permissions");
  });

  it("rpcDispatcher should handle cli.models method", async () => {
    const res = await rpcDispatcher.handle({
      id: "test-models-1",
      method: "cli.models",
    });

    assert.equal(res.id, "test-models-1");
    assert.ok(res.result, "Expected models result");
    const data = res.result as any;

    assert.ok(Array.isArray(data.models), "Expected models array");
    assert.ok(data.models.length > 0, "Models array should not be empty");

    const defaultModel = data.models.find((m: any) => m.isDefault);
    assert.ok(defaultModel, "Expected at least one default model");
    assert.equal(defaultModel.id, "gemini-3.8-flash-high");

    for (const m of data.models) {
      assert.ok(m.id, "Each model must have an id");
      assert.ok(m.name, "Each model must have a name");
      assert.equal(typeof m.supportsEffort, "boolean");
    }
  });

  it("rpcDispatcher should return error string for unknown methods", async () => {
    const res = await rpcDispatcher.handle({
      id: "test-err-1",
      method: "nonexistent.method",
    });

    assert.equal(res.id, "test-err-1");
    assert.ok(res.error, "Expected error string");
    assert.match(res.error!, /Method not found/);
  });

  it("rpcDispatcher should handle sessions.list with pagination", async () => {
    const res = await rpcDispatcher.handle({
      id: "test-list-1",
      method: "sessions.list",
      params: { limit: 5, offset: 0 },
    });

    assert.equal(res.id, "test-list-1");
    assert.ok(res.result, "Expected session list result");
    const paged = res.result as any;

    assert.equal(typeof paged.total, "number");
    assert.ok(Array.isArray(paged.items));
    assert.equal(typeof paged.hasMore, "boolean");
    assert.ok(paged.items.length <= 5, `Expected items.length <= 5, got ${paged.items.length}`);
  });
});
