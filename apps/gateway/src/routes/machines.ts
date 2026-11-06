import type { IncomingMessage, ServerResponse } from "node:http";
import crypto from "node:crypto";
import { verifyUserJwt, type AuthenticatedUser } from "../auth/jwt.js";
import {
  createMachineRecord,
  findMachinesByUserId,
  deleteMachineRecord,
} from "../db/machine-repo.js";
import { daemonHub } from "../hub/daemon-hub.js";
import { rpcRouter } from "../hub/rpc-router.js";

interface PendingPairingSession {
  pairId: string;
  pairCode: string; // e.g. "CA-7842"
  secret: string;
  machineName: string;
  platform?: string;
  arch?: string;
  createdAt: number;
  expiresAt: number;
  status: "pending" | "claimed";
  claimedByUserId?: string;
  plainToken?: string;
  machineRecordId?: string;
}

const pendingPairings = new Map<string, PendingPairingSession>(); // pairId -> session
const codeToPairId = new Map<string, string>(); // pairCode -> pairId

// Clean up expired pairing sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [pairId, session] of pendingPairings.entries()) {
    if (session.expiresAt < now) {
      codeToPairId.delete(session.pairCode.toUpperCase());
      pendingPairings.delete(pairId);
    }
  }
}, 60_000);

export function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
  res.end(JSON.stringify(data));
}

export function parseAuthUser(req: IncomingMessage): AuthenticatedUser | null {
  const authHeader = req.headers["authorization"] || "";
  if (!authHeader) return null;
  return verifyUserJwt(authHeader);
}

export async function parseBody<T = any>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1e6) {
        req.destroy();
        reject(new Error("Body too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
  });
}

export async function handleMachinesRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL
): Promise<boolean> {
  const path = url.pathname;
  const method = req.method?.toUpperCase();

  // CORS preflight
  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    });
    res.end();
    return true;
  }

  // --- Reverse Daemon-First Pairing Endpoints ---

  // P1. POST /api/machines/pair/init - Daemon initiates pairing (unauthenticated)
  if (path === "/api/machines/pair/init" && method === "POST") {
    try {
      const body = await parseBody(req);
      const machineName = body.machineName || body.name || `Node-${Math.random().toString(36).slice(2, 6)}`;
      const pairId = `pair_${crypto.randomUUID()}`;
      const codeDigits = Math.floor(1000 + Math.random() * 9000);
      const pairCode = `CA-${codeDigits}`;
      const secret = crypto.randomBytes(16).toString("hex");
      const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

      const session: PendingPairingSession = {
        pairId,
        pairCode,
        secret,
        machineName,
        platform: body.platform,
        arch: body.arch,
        createdAt: Date.now(),
        expiresAt,
        status: "pending",
      };

      pendingPairings.set(pairId, session);
      codeToPairId.set(pairCode.toUpperCase(), pairId);

      const qrPayload = `ca_pair://claim?id=${encodeURIComponent(pairId)}&code=${encodeURIComponent(pairCode)}&secret=${encodeURIComponent(secret)}&name=${encodeURIComponent(machineName)}`;

      console.log(`[MachinePairing] Initiated pairing session: ${pairCode} (${pairId}) for "${machineName}"`);

      sendJson(res, 201, {
        pairId,
        pairCode,
        secret,
        qrPayload,
        expiresAt,
        machineName,
      });
    } catch (err) {
      sendJson(res, 500, { error: (err as Error).message });
    }
    return true;
  }

  // P2. GET /api/machines/pair/poll - Daemon polls for mobile confirmation
  if (path === "/api/machines/pair/poll" && method === "GET") {
    const pairId = url.searchParams.get("id");
    const secret = url.searchParams.get("secret");

    if (!pairId || !secret) {
      sendJson(res, 400, { error: "Missing pairId or secret in query parameters" });
      return true;
    }

    const session = pendingPairings.get(pairId);
    if (!session || session.secret !== secret || session.expiresAt < Date.now()) {
      sendJson(res, 404, { error: "Pairing session not found or expired" });
      return true;
    }

    if (session.status === "claimed" && session.plainToken) {
      // Clean up after consuming
      pendingPairings.delete(pairId);
      codeToPairId.delete(session.pairCode.toUpperCase());

      sendJson(res, 200, {
        status: "claimed",
        token: session.plainToken,
        machineId: session.machineRecordId,
        name: session.machineName,
      });
      return true;
    }

    sendJson(res, 200, {
      status: "pending",
      pairCode: session.pairCode,
      expiresInSec: Math.max(0, Math.round((session.expiresAt - Date.now()) / 1000)),
    });
    return true;
  }

  // P3. POST /api/machines/pair/claim - Mobile authorizes pairing with User JWT
  if (path === "/api/machines/pair/claim" && method === "POST") {
    const user = parseAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Unauthorized: Missing or invalid JWT token" });
      return true;
    }

    try {
      const body = await parseBody(req);
      let pairId = body.pairId || body.id;
      const secret = body.secret;
      const code = (body.code || body.pairCode || "").trim().toUpperCase();

      if (!pairId && code) {
        pairId = codeToPairId.get(code);
      }

      if (!pairId) {
        sendJson(res, 404, { error: "Invalid pairing code or ID" });
        return true;
      }

      const session = pendingPairings.get(pairId);
      if (!session || session.expiresAt < Date.now()) {
        sendJson(res, 404, { error: "Pairing session expired or not found" });
        return true;
      }

      if (secret && session.secret !== secret) {
        sendJson(res, 403, { error: "Invalid pairing secret" });
        return true;
      }

      // Generate permanent machine record and token for this user
      const { machine, plainToken } = await createMachineRecord(
        user.userId,
        body.name || session.machineName
      );

      session.status = "claimed";
      session.claimedByUserId = user.userId;
      session.plainToken = plainToken;
      session.machineRecordId = machine.machineId;

      console.log(`[MachinePairing] Successfully claimed machine "${machine.name}" (${machine.machineId}) for user ${user.userId}`);

      sendJson(res, 200, {
        success: true,
        machine: {
          machineId: machine.machineId,
          name: machine.name,
          tokenPrefix: machine.tokenPrefix,
        },
        message: `Machine "${machine.name}" successfully paired!`,
      });
    } catch (err) {
      sendJson(res, 500, { error: (err as Error).message });
    }
    return true;
  }

  // 1. GET /api/machines - List user's machines
  if (path === "/api/machines" && method === "GET") {
    const user = parseAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Unauthorized: Missing or invalid JWT token" });
      return true;
    }

    try {
      const machines = await findMachinesByUserId(user.userId);
      // Augment with real-time in-memory online status
      const augmented = machines.map((m) => ({
        ...m,
        isOnline: daemonHub.isOnline(m.machineId),
      }));
      sendJson(res, 200, { machines: augmented });
    } catch (err) {
      sendJson(res, 500, { error: (err as Error).message });
    }
    return true;
  }

  // 2. POST /api/machines/token - Generate a new machine pairing token
  if (path === "/api/machines/token" && method === "POST") {
    const user = parseAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Unauthorized: Missing or invalid JWT token" });
      return true;
    }

    try {
      const body = await parseBody(req);
      const machineName = body.name || `VPS-${Math.random().toString(36).slice(2, 6)}`;
      const { machine, plainToken } = await createMachineRecord(user.userId, machineName);

      const installCommand = `cloud-agent-daemon start --token "${plainToken}"`;

      sendJson(res, 201, {
        machineId: machine.machineId,
        name: machine.name,
        token: plainToken,
        tokenPrefix: machine.tokenPrefix,
        installCommand,
        instructions: `Run this command on your VPS where your CLI coding agent (e.g. Antigravity) is installed:`,
      });
    } catch (err) {
      sendJson(res, 500, { error: (err as Error).message });
    }
    return true;
  }

  // 3. DELETE /api/machines/:machineId - Revoke machine
  if (path.startsWith("/api/machines/") && method === "DELETE") {
    const user = parseAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Unauthorized" });
      return true;
    }

    const machineId = path.split("/")[3];
    if (!machineId) {
      sendJson(res, 400, { error: "Missing machineId in URL" });
      return true;
    }

    try {
      daemonHub.unregister(machineId);
      const deleted = await deleteMachineRecord(user.userId, machineId);
      sendJson(res, 200, { success: deleted });
    } catch (err) {
      sendJson(res, 500, { error: (err as Error).message });
    }
    return true;
  }

  // 4. POST /api/machines/:machineId/rpc - HTTP RPC bridge endpoint
  if (path.startsWith("/api/machines/") && path.endsWith("/rpc") && method === "POST") {
    const user = parseAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Unauthorized" });
      return true;
    }

    const machineId = path.split("/")[3];
    try {
      const body = await parseBody(req);
      const response = await rpcRouter.route(user, {
        id: body.id || `http_rpc_${Date.now()}`,
        machineId,
        method: body.method,
        params: body.params || {},
      });
      sendJson(res, 200, response);
    } catch (err) {
      sendJson(res, 400, { error: (err as Error).message });
    }
    return true;
  }

  // 5. POST /api/machines/:machineId/approve - Quick approval bridge for background/lockscreen push
  if (path.startsWith("/api/machines/") && path.endsWith("/approve") && method === "POST") {
    const machineId = path.split("/")[3];
    try {
      const body = await parseBody(req);
      const { approvalId, allowed } = body;
      if (!approvalId || typeof allowed !== "boolean") {
        sendJson(res, 400, { error: "Missing approvalId or allowed boolean parameter" });
        return true;
      }

      const resRpc = await daemonHub.sendRpc(machineId, "agent.approve", { approvalId, allowed });
      console.log(`[MachinesRoute] Forwarded lockscreen approval for machine=${machineId} approvalId=${approvalId} allowed=${allowed}:`, JSON.stringify(resRpc));
      sendJson(res, 200, { success: true, machineId, approvalId, allowed, result: resRpc });
    } catch (err) {
      sendJson(res, 400, { error: (err as Error).message });
    }
    return true;
  }

  return false;
}
