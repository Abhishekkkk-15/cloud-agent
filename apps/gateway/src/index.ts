import http from "node:http";
import dns from "node:dns";
import { config } from "./config.js";
import { connectMongo, closeMongo } from "./db/mongo.js";
import { handleMachinesRoutes, sendJson } from "./routes/machines.js";
import { handleAuthRoutes } from "./routes/auth.js";
import { handlePushRoutes } from "./routes/push.js";
import { handleWebhookRoutes } from "./routes/webhooks.js";
import { setupWebSocketUpgrades } from "./routes/ws.js";
import { daemonHub } from "./hub/daemon-hub.js";

// Ensure DNS SRV resolution succeeds across environments (especially on Windows)
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch {
  // Ignore if permissions or platform prevent custom DNS
}

async function main() {
  console.log(`
┌───────────────────────────────────────────────┐
│              Cloud Agent Gateway              │
│       Dedicated Node.js WebSocket Hub         │
└───────────────────────────────────────────────┘
`);

  // Connect to MongoDB
  try {
    await connectMongo();
  } catch {
    console.warn("[Gateway] Starting with MongoDB uninitialized. Machine lookups will fail until DB is online.");
  }

  // Create HTTP Server
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

      // Healthcheck
      if (url.pathname === "/" || url.pathname === "/health") {
        sendJson(res, 200, {
          status: "healthy",
          server: "Cloud Agent Gateway",
          timestamp: new Date().toISOString(),
          connectedDaemons: daemonHub.getConnectedCount(),
        });
        return;
      }

      // Authentication API routes (/auth/*, /api/auth/*)
      const authHandled = await handleAuthRoutes(req, res, url);
      if (authHandled) return;

      // Machines API routes
      const handled = await handleMachinesRoutes(req, res, url);
      if (handled) return;

      // Push Notification API routes (/api/push/*, /push/*)
      const pushHandled = await handlePushRoutes(req, res, url);
      if (pushHandled) return;

      // Webhook API routes (/webhooks/*)
      const webhookHandled = await handleWebhookRoutes(req, res, url);
      if (webhookHandled) return;

      // 404
      sendJson(res, 404, { error: `Route not found: ${req.method} ${url.pathname}` });
    } catch (err) {
      console.error("[Gateway HTTP Error]", err);
      sendJson(res, 500, { error: "Internal server error" });
    }
  });

  // Attach WebSocket Upgrades for /daemon/ws and /client/ws
  setupWebSocketUpgrades(server);

  server.listen(config.port, () => {
    console.log(`[Gateway] Server listening on http://localhost:${config.port}`);
    console.log(`[Gateway] Google OAuth endpoint: http://localhost:${config.port}/auth/google`);
    console.log(`[Gateway] Developer Auth:       http://localhost:${config.port}/auth/dev-login`);
    console.log(`[Gateway] VPS Daemon endpoint:  ws://localhost:${config.port}/daemon/ws`);
    console.log(`[Gateway] Client UI endpoint:   ws://localhost:${config.port}/client/ws`);
    console.log(`[Gateway] Machines REST API:    http://localhost:${config.port}/api/machines`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log("\n[Gateway] Shutting down gateway server...");
    server.close();
    await closeMongo();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
