import { describe, it } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { CliAdapterRegistry } from "../src/registry.js";
import { rpcDispatcher } from "../src/rpc/index.js";
import { BaseCliAdapter } from "@cloud-agent/cli-interface";

class MockCustomAdapter extends BaseCliAdapter {
  readonly id = "custom-test-adapter";
  readonly displayName = "Custom Test Adapter";
  readonly binaryName = "custom-bin";

  async checkAvailability() {
    return { available: true, version: "2.0.0" };
  }
}

describe("@cloud-agent/daemon - Adapter Registry, Tunnel Proxy & Auto-Healer", () => {
  it("CliAdapterRegistry should manage adapters, default selection, and availability checks", async () => {
    const reg = new CliAdapterRegistry();

    // Default adapter is antigravity
    const defaultAdapter = reg.get();
    assert.equal(defaultAdapter.id, "antigravity");

    // Register custom adapter
    reg.register(new MockCustomAdapter());
    const custom = reg.get("custom-test-adapter");
    assert.equal(custom.displayName, "Custom Test Adapter");

    // Check list
    const list = reg.list();
    const ids = list.map((a) => a.id);
    assert.ok(ids.includes("antigravity"));
    assert.ok(ids.includes("custom-test-adapter"));

    // Check availability
    const avail = await reg.checkAll();
    assert.ok(avail["custom-test-adapter"].available);
    assert.equal(avail["custom-test-adapter"].version, "2.0.0");

    // Switch default
    reg.setDefault("custom-test-adapter");
    assert.equal(reg.get().id, "custom-test-adapter");

    // Unregistered adapter must throw
    assert.throws(() => reg.get("non-existent-adapter"), /not registered/);
  });

  it("tunnel.proxy_request should validate local port boundaries", async () => {
    const invalidPortRes = await rpcDispatcher.handle({
      id: "test-tunnel-invalid-port",
      method: "tunnel.proxy_request",
      params: { port: 999999 },
    });

    assert.ok(invalidPortRes.error, "Invalid port must be rejected");
    assert.match(invalidPortRes.error!, /Invalid local port/);

    const negativePortRes = await rpcDispatcher.handle({
      id: "test-tunnel-neg-port",
      method: "tunnel.proxy_request",
      params: { port: -1 },
    });
    assert.ok(negativePortRes.error, "Negative port must be rejected");
  });

  it("tunnel.proxy_request should proxy HTTP requests to a local service and return response", async () => {
    // Spin up an ephemeral local HTTP test server
    const server = http.createServer((req, res) => {
      res.writeHead(200, { "Content-Type": "text/plain", "X-Custom-Header": "cloud-agent" });
      res.end("hello-from-local-tunnel-endpoint");
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address() as { port: number };
    const port = address.port;

    try {
      const res = await rpcDispatcher.handle({
        id: "test-tunnel-proxy-call",
        method: "tunnel.proxy_request",
        params: {
          port,
          method: "GET",
          path: "/test",
          headers: {},
        },
      });

      assert.equal(res.id, "test-tunnel-proxy-call");
      assert.ok(res.result, "Expected proxy response result");
      const proxyResult = res.result as {
        statusCode: number;
        headers: Record<string, string>;
        bodyBase64: string;
      };

      assert.equal(proxyResult.statusCode, 200);
      assert.equal(proxyResult.headers["x-custom-header"], "cloud-agent");

      const decodedBody = Buffer.from(proxyResult.bodyBase64, "base64").toString("utf8");
      assert.equal(decodedBody, "hello-from-local-tunnel-endpoint");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("auto_healer RPC methods should validate required parameters", async () => {
    const triggerErr = await rpcDispatcher.handle({
      id: "test-ah-trigger-err",
      method: "auto_healer.trigger",
      params: {},
    });
    assert.ok(triggerErr.error, "Missing incident param must fail");

    const approveErr = await rpcDispatcher.handle({
      id: "test-ah-approve-err",
      method: "auto_healer.approve",
      params: {},
    });
    assert.ok(approveErr.error, "Missing incidentId param must fail");
  });
});
