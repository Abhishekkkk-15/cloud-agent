import http from "node:http";
import jwt from "jsonwebtoken";
import { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate } from "werift";
import { config } from "./config.js";
import { connectMongo, closeMongo } from "./db/mongo.js";
import { createMachineRecord, deleteMachineRecord } from "./db/machine-repo.js";
import { setupWebSocketUpgrades } from "./routes/ws.js";
import { daemonHub } from "./hub/daemon-hub.js";
import { GatewayConnection } from "../../daemon/src/connection.js";

async function runWebRtcE2eTest() {
  console.log("=== 1. Connecting to MongoDB ===");
  await connectMongo();

  const testUserId = "user_p2p_tester_789";
  const testPort = 8092;

  console.log("\n=== 2. Creating Machine Pairing Record ===");
  const { machine, plainToken } = await createMachineRecord(testUserId, "P2P-VPS-Test");
  console.log(`Machine created: [${machine.machineId}] Name: ${machine.name}`);

  console.log(`\n=== 3. Starting Gateway on port ${testPort} ===`);
  const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end("ok");
  });
  setupWebSocketUpgrades(server);

  await new Promise<void>((resolve) => {
    server.listen(testPort, () => resolve());
  });
  console.log(`Gateway running on http://localhost:${testPort}`);

  console.log("\n=== 4. Starting VPS Daemon with WebRTC Support ===");
  const daemonConnection = new GatewayConnection({
    machineId: machine.machineId,
    machineName: machine.name,
    gatewayUrl: `ws://localhost:${testPort}`,
    token: plainToken,
    heartbeatIntervalMs: 5000,
  });
  daemonConnection.start();

  // Wait for daemon connection
  for (let i = 0; i < 20; i++) {
    if (daemonHub.isOnline(machine.machineId)) break;
    await new Promise((r) => setTimeout(r, 200));
  }

  if (!daemonHub.isOnline(machine.machineId)) {
    throw new Error("Daemon failed to connect to Gateway");
  }
  console.log("[PASS] Daemon is online on Gateway!");

  console.log("\n=== 5. Simulating Browser Client connecting to Gateway for WebRTC Signaling ===");
  const userJwt = jwt.sign({ sub: testUserId, role: "user" }, config.jwtSecret, { algorithm: "HS256" });
  const clientWs = new WebSocket(`ws://localhost:${testPort}/client/ws?token=${userJwt}`);

  let assignedClientId = "";
  await new Promise<void>((resolve, reject) => {
    clientWs.onopen = () => console.log("Client connected to Gateway WebSocket.");
    clientWs.onmessage = (event) => {
      const msg = JSON.parse(event.data.toString());
      if (msg.type === "client.ready") {
        assignedClientId = msg.clientId;
        resolve();
      }
    };
    clientWs.onerror = (e) => reject(e);
  });
  console.log(`Client ready with assigned ID: ${assignedClientId}`);

  console.log("\n=== 6. Initiating WebRTC P2P DataChannel Handshake ===");
  const clientPc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  });

  const dataChannel = clientPc.createDataChannel("cloud-agent-rpc");
  console.log(`Client created DataChannel: '${dataChannel.label}'`);

  // Relay ICE candidates from Client -> Gateway -> Daemon
  clientPc.onIceCandidate.subscribe((candidate) => {
    if (candidate && clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(
        JSON.stringify({
          type: "webrtc.candidate",
          machineId: machine.machineId,
          clientId: assignedClientId,
          candidate: candidate.toJSON ? candidate.toJSON() : candidate,
        })
      );
    }
  });

  // Handle incoming signaling responses from Daemon -> Gateway -> Client
  clientWs.onmessage = async (event) => {
    const msg = JSON.parse(event.data.toString());
    if (msg.type === "webrtc.answer" && msg.sdp) {
      console.log("[Signaling] Client received SDP Answer from Daemon via Gateway!");
      await clientPc.setRemoteDescription(new RTCSessionDescription(msg.sdp, "answer"));
    } else if (msg.type === "webrtc.candidate" && msg.candidate) {
      await clientPc.addIceCandidate(new RTCIceCandidate(msg.candidate));
    }
  };

  // Create SDP Offer
  const offer = await clientPc.createOffer();
  await clientPc.setLocalDescription(offer);

  // Send Offer via Gateway
  console.log("[Signaling] Client sending SDP Offer to Daemon via Gateway...");
  clientWs.send(
    JSON.stringify({
      type: "webrtc.offer",
      machineId: machine.machineId,
      clientId: assignedClientId,
      sdp: offer.sdp,
    })
  );

  // Wait for DataChannel to transition to 'open' state
  console.log("Waiting for direct WebRTC DataChannel to open P2P...");
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("WebRTC DataChannel open timeout")), 15000);
    dataChannel.stateChange.subscribe((state) => {
      console.log(`[P2P] Client DataChannel state: ${state}`);
      if (state === "open") {
        clearTimeout(timer);
        resolve();
      }
    });
  });

  console.log("\n========================================================");
  console.log("🎉 SUCCESS: WebRTC Direct DataChannel is OPEN Peer-to-Peer!");
  console.log("========================================================\n");

  console.log("=== 7. Testing RPC Execution DIRECTLY over WebRTC (Zero Gateway Proxying) ===");

  // Send JSON-RPC directly over the DataChannel
  const p2pResponsePromise = new Promise<any>((resolve) => {
    dataChannel.onMessage.subscribe((msg) => {
      const raw = typeof msg === "string" ? msg : msg.toString();
      const parsed = JSON.parse(raw);
      resolve(parsed);
    });
  });

  const rpcPayload = JSON.stringify({
    id: "p2p-req-1",
    method: "daemon.status",
    params: {},
  });

  console.log(`Sending direct P2P message: ${rpcPayload}`);
  dataChannel.send(rpcPayload);

  const directResponse = await p2pResponsePromise;
  console.log("\n[PASS] Received response directly via WebRTC DataChannel:");
  console.log(JSON.stringify(directResponse, null, 2));

  // Test 8: sessions.list directly over WebRTC
  console.log("\n=== 8. Testing sessions.list directly over WebRTC DataChannel ===");
  const p2pSessionsPromise = new Promise<any>((resolve) => {
    dataChannel.onMessage.subscribe((msg) => {
      const raw = typeof msg === "string" ? msg : msg.toString();
      const parsed = JSON.parse(raw);
      if (parsed.id === "p2p-req-2") {
        resolve(parsed);
      }
    });
  });

  dataChannel.send(
    JSON.stringify({
      id: "p2p-req-2",
      method: "sessions.list",
      params: { limit: 5 },
    })
  );

  const sessionsResponse = await p2pSessionsPromise;
  console.log(
    `[PASS] sessions.list returned ${sessionsResponse.result.items.length} sessions directly via WebRTC DataChannel!`
  );

  // Cleanup
  console.log("\n=== 9. Cleaning Up ===");
  dataChannel.close();
  clientPc.close();
  clientWs.close();
  daemonConnection.stop();
  await new Promise((r) => setTimeout(r, 200));
  await deleteMachineRecord(testUserId, machine.machineId);
  server.close();
  await closeMongo();
  console.log("\n🎉 ALL WEBRTC P2P TESTS COMPLETED SUCCESSFULLY!");
}

runWebRtcE2eTest().catch(async (err) => {
  console.error("WebRTC Test Failed:", err);
  await closeMongo();
  process.exit(1);
});
