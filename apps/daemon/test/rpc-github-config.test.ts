import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { rpcDispatcher } from "../src/rpc/index.js";
import { loadConfig, saveConfig, getGithubToken, setGithubToken, clearGithubToken } from "../src/config.js";

describe("@cloud-agent/daemon - GitHub Integration & Config", () => {
  it("ping should return pong with timestamp and uptime", async () => {
    const res = await rpcDispatcher.handle({
      id: "test-ping-1",
      method: "ping",
    });

    assert.equal(res.id, "test-ping-1");
    assert.ok(res.result, "Expected result");
    const pingData = res.result as { pong: boolean; timestamp: string; uptime: number };
    assert.equal(pingData.pong, true);
    assert.ok(pingData.timestamp);
    assert.equal(typeof pingData.uptime, "number");
  });

  it("config helper should load, persist, and mutate GitHub token", () => {
    const originalToken = getGithubToken();

    try {
      const testToken = "ghp_mock_token_for_automated_test_12345";
      setGithubToken(testToken);

      const loadedToken = getGithubToken();
      assert.equal(loadedToken, testToken);

      clearGithubToken();
      const clearedToken = getGithubToken();
      // If no env GITHUB_TOKEN is set, it must be undefined
      if (!process.env.GITHUB_TOKEN && !process.env.GH_TOKEN) {
        assert.equal(clearedToken, undefined);
      }
    } finally {
      if (originalToken) {
        setGithubToken(originalToken);
      } else {
        clearGithubToken();
      }
    }
  });

  it("github.status should report authentication state and local git identity", async () => {
    const res = await rpcDispatcher.handle({
      id: "test-gh-status-1",
      method: "github.status",
    });

    assert.equal(res.id, "test-gh-status-1");
    assert.ok(res.result, "Expected github status result");
    const status = res.result as any;

    assert.equal(typeof status.authenticated, "boolean");
    assert.ok(["token", "cli", "none"].includes(status.source));
    assert.equal(typeof status.hasGhCli, "boolean");
  });

  it("github.setToken should validate token parameter", async () => {
    const errRes = await rpcDispatcher.handle({
      id: "test-gh-settoken-empty",
      method: "github.setToken",
      params: { token: "" },
    });

    assert.ok(errRes.error, "Empty token must be rejected");
    assert.match(errRes.error!, /Missing or invalid token/);
  });

  it("github.removeToken should clear token and return success", async () => {
    const res = await rpcDispatcher.handle({
      id: "test-gh-remove-1",
      method: "github.removeToken",
    });

    assert.equal(res.id, "test-gh-remove-1");
    assert.ok(res.result);
    assert.equal((res.result as any)?.success, true);
  });
});
