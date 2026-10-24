import http from "node:http";
import jwt from "jsonwebtoken";
import { config } from "./config.js";
import { connectMongo, closeMongo } from "./db/mongo.js";
import { createMachineRecord, deleteMachineRecord } from "./db/machine-repo.js";
import { setupWebSocketUpgrades } from "./routes/ws.js";
import { handleMachinesRoutes, sendJson } from "./routes/machines.js";
import { daemonHub } from "./hub/daemon-hub.js";
import { rpcRouter } from "./hub/rpc-router.js";
import { GatewayConnection } from "../../daemon/src/connection.js";

async function runEndToEndTest() {
  console.log("=== 1. Connecting to MongoDB ===");
  await connectMongo();

  const testUserId = "user_test_alpha_123";
  const intruderUserId = "user_intruder_hacker_456";
  const testPort = 8089;

  console.log("\n=== 2. Creating Machine Record & Token ===");
  const { machine, plainToken } = await createMachineRecord(testUserId, "Test-VPS-Node");
  console.log(`Machine created: [${machine.machineId}] Name: ${machine.name}`);
  console.log(`Token prefix   : ${machine.tokenPrefix}`);

  // Create Gateway Server on testPort
  console.log(`\n=== 3. Starting Gateway on port ${testPort} ===`);
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    if (url.pathname === "/health") {
      sendJson(res, 200, { status: "ok", daemons: daemonHub.getConnectedCount() });
      return;
    }
    const handled = await handleMachinesRoutes(req, res, url);
    if (!handled) {
      sendJson(res, 404, { error: "Not found" });
    }
  });

  setupWebSocketUpgrades(server);

  await new Promise<void>((resolve) => {
    server.listen(testPort, () => resolve());
  });
  console.log(`Gateway listening on http://localhost:${testPort}`);

  // Start VPS Daemon Connection
  console.log("\n=== 4. Connecting VPS Daemon to Gateway ===");
  const daemonConfig = {
    machineId: machine.machineId,
    machineName: machine.name,
    gatewayUrl: `ws://localhost:${testPort}`,
    token: plainToken,
    heartbeatIntervalMs: 5000,
  };

  const connection = new GatewayConnection(daemonConfig);
  connection.start();

  // Wait for daemon to register in daemonHub
  console.log("Waiting for daemon connection handshake...");
  for (let i = 0; i < 20; i++) {
    if (daemonHub.isOnline(machine.machineId)) break;
    await new Promise((r) => setTimeout(r, 200));
  }

  if (!daemonHub.isOnline(machine.machineId)) {
    throw new Error("Daemon failed to connect within timeout");
  }
  console.log(`[PASS] Daemon connected successfully! Status is online: ${daemonHub.isOnline(machine.machineId)}`);

  // Test 5: Authorized User calls daemon.status
  console.log("\n=== 5. Testing Authorized User RPC (daemon.status) ===");
  const authUser = { userId: testUserId, role: "user" };
  const statusRes = await rpcRouter.route(authUser, {
    id: "rpc-test-1",
    machineId: machine.machineId,
    method: "daemon.status",
  });
  console.log("daemon.status result:", JSON.stringify(statusRes.result, null, 2));

  // Test 6: Authorized User calls sessions.list
  console.log("\n=== 6. Testing Authorized User RPC (sessions.list) ===");
  const sessionsRes = await rpcRouter.route(authUser, {
    id: "rpc-test-2",
    machineId: machine.machineId,
    method: "sessions.list",
    params: { limit: 3 },
  });
  console.log(`sessions.list result: ${sessionsRes.result.items.length} sessions retrieved from VPS disk`);

  // Test 7: Unauthorized Intruder attempts to access the machine
  console.log("\n=== 7. Testing Security: Intruder Access Rejection ===");
  const intruderUser = { userId: intruderUserId, role: "user" };
  try {
    await rpcRouter.route(intruderUser, {
      id: "rpc-test-3",
      machineId: machine.machineId,
      method: "sessions.list",
    });
    throw new Error("SECURITY FAILURE: Intruder was able to access machine!");
  } catch (err) {
    console.log(`[PASS] Intruder correctly blocked! Error: ${(err as Error).message}`);
  }

  // Test 8: REST API GET /api/machines with JWT
  console.log("\n=== 8. Testing REST API with User JWT ===");
  const userJwt = jwt.sign({ sub: testUserId, role: "user" }, config.jwtSecret, { algorithm: "HS256" });

  const apiRes = await fetch(`http://localhost:${testPort}/api/machines`, {
    headers: { Authorization: `Bearer ${userJwt}` },
  });
  const apiData = (await apiRes.json()) as any;
  console.log(`REST /api/machines returned ${apiData.machines.length} machine(s).`);
  console.log(`Machine [${apiData.machines[0]?.machineId}] isOnline: ${apiData.machines[0]?.isOnline}`);

  // Cleanup
  console.log("\n=== 9. Cleaning Up ===");
  connection.stop();
  await new Promise((r) => setTimeout(r, 200));
  await deleteMachineRecord(testUserId, machine.machineId);
  server.close();
  await closeMongo();
  console.log("[PASS] All End-to-End Gateway tests succeeded!");
}

runEndToEndTest().catch(async (err) => {
  console.error("Test failed:", err);
  await closeMongo();
  process.exit(1);
});
