import type { IncomingMessage, ServerResponse } from "node:http";
import { verifyUserJwt, type AuthenticatedUser } from "../auth/jwt.js";
import {
  createMachineRecord,
  findMachinesByUserId,
  deleteMachineRecord,
} from "../db/machine-repo.js";
import { daemonHub } from "../hub/daemon-hub.js";
import { rpcRouter } from "../hub/rpc-router.js";

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

  return false;
}
