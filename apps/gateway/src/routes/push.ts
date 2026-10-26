import type { IncomingMessage, ServerResponse } from "node:http";
import { sendJson } from "./machines.js";
import { verifyUserJwt, type AuthenticatedUser } from "../auth/jwt.js";
import {
  sendExpoPushNotifications,
  isExpoPushToken,
  type PushNotificationMessage,
  type ExpoPushTicket,
} from "../push/expo-push.js";

interface RegisteredDevice {
  token: string;
  userId: string;
  machineId?: string;
  platform?: string;
  registeredAt: string;
  lastActiveAt: string;
}

// In-memory token store (strictly adhering to Zero-DB Daemon & Gateway Invariant)
const tokenRegistry = new Map<string, RegisteredDevice>(); // pushToken -> RegisteredDevice
const userTokens = new Map<string, Set<string>>(); // userId -> Set<pushToken>
const machineTokens = new Map<string, Set<string>>(); // machineId -> Set<pushToken>

export function registerPushToken(
  token: string,
  userId: string,
  machineId?: string,
  platform?: string
): void {
  if (!isExpoPushToken(token)) {
    throw new Error(`Invalid Expo push token format: ${token}`);
  }

  const existing = tokenRegistry.get(token);
  const now = new Date().toISOString();

  tokenRegistry.set(token, {
    token,
    userId,
    machineId,
    platform: platform || "unknown",
    registeredAt: existing?.registeredAt || now,
    lastActiveAt: now,
  });

  // Index by user
  if (!userTokens.has(userId)) {
    userTokens.set(userId, new Set());
  }
  userTokens.get(userId)!.add(token);

  // Index by machine
  if (machineId) {
    if (!machineTokens.has(machineId)) {
      machineTokens.set(machineId, new Set());
    }
    machineTokens.get(machineId)!.add(token);
  }

  console.log(`[PushRegistry] Registered push token for user=${userId} machine=${machineId || "none"} (${token.slice(0, 24)}...)`);
}

export function unregisterPushToken(token: string): void {
  const record = tokenRegistry.get(token);
  if (record) {
    userTokens.get(record.userId)?.delete(token);
    if (record.machineId) {
      machineTokens.get(record.machineId)?.delete(token);
    }
    tokenRegistry.delete(token);
    console.log(`[PushRegistry] Unregistered push token: ${token.slice(0, 24)}...`);
  }
}

/**
 * Sends a notification to all devices registered to a specific user.
 */
export async function notifyUser(
  userId: string,
  message: {
    title: string;
    body: string;
    data?: Record<string, any>;
    channelId?: string;
  }
): Promise<ExpoPushTicket[]> {
  const tokens = Array.from(userTokens.get(userId) || []);
  if (tokens.length === 0) {
    return [];
  }

  return sendExpoPushNotifications([
    {
      to: tokens,
      title: message.title,
      body: message.body,
      data: message.data,
      channelId: message.channelId || "agent-alerts",
      priority: "high",
    },
  ]);
}

/**
 * Sends a notification to all devices registered to a specific machine.
 */
export async function notifyMachineSubscribers(
  machineId: string,
  message: {
    title: string;
    body: string;
    data?: Record<string, any>;
    channelId?: string;
  }
): Promise<ExpoPushTicket[]> {
  const tokens = Array.from(machineTokens.get(machineId) || []);
  if (tokens.length === 0) {
    return [];
  }

  return sendExpoPushNotifications([
    {
      to: tokens,
      title: message.title,
      body: message.body,
      data: message.data,
      channelId: message.channelId || "agent-alerts",
      priority: "high",
    },
  ]);
}

function parseAuth(req: IncomingMessage): AuthenticatedUser | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    return verifyUserJwt(token);
  }
  return null;
}

async function readJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

export async function handlePushRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL
): Promise<boolean> {
  // 1. POST /api/push/register
  if (req.method === "POST" && (url.pathname === "/api/push/register" || url.pathname === "/push/register")) {
    try {
      const body = await readJsonBody(req);
      const user = parseAuth(req);

      const userId = user?.userId || body.userId || "anonymous";
      const token = body.token || body.pushToken;
      const machineId = body.machineId;
      const platform = body.platform;

      if (!token) {
        sendJson(res, 400, { error: "Missing required 'token' parameter" });
        return true;
      }

      if (!isExpoPushToken(token)) {
        sendJson(res, 400, { error: `Invalid Expo push token: ${token}` });
        return true;
      }

      registerPushToken(token, userId, machineId, platform);

      sendJson(res, 200, {
        success: true,
        message: "Push token registered successfully",
        token: `${token.slice(0, 20)}...`,
        userId,
      });
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      sendJson(res, 500, { error: msg });
      return true;
    }
  }

  // 2. POST /api/push/test
  if (req.method === "POST" && (url.pathname === "/api/push/test" || url.pathname === "/push/test")) {
    try {
      const body = await readJsonBody(req);
      const user = parseAuth(req);
      const token = body.token || body.pushToken;

      const targetTokens: string[] = [];
      if (token && isExpoPushToken(token)) {
        targetTokens.push(token);
      } else if (user?.userId && userTokens.has(user.userId)) {
        targetTokens.push(...Array.from(userTokens.get(user.userId)!));
      }

      if (targetTokens.length === 0) {
        sendJson(res, 400, {
          error: "No target push token found. Please register a push token first.",
        });
        return true;
      }

      const tickets = await sendExpoPushNotifications([
        {
          to: targetTokens,
          title: body.title || "Cloud Agent • Test Notification",
          body: body.body || "Real native push notifications are operational on your device!",
          data: { test: true, timestamp: Date.now() },
          channelId: "agent-alerts",
          priority: "high",
        },
      ]);

      sendJson(res, 200, {
        success: true,
        deliveredTo: targetTokens.length,
        tickets,
      });
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      sendJson(res, 500, { error: msg });
      return true;
    }
  }

  // 3. GET /api/push/status
  if (req.method === "GET" && (url.pathname === "/api/push/status" || url.pathname === "/push/status")) {
    sendJson(res, 200, {
      status: "online",
      registeredTokens: tokenRegistry.size,
      registeredUsers: userTokens.size,
      registeredMachines: machineTokens.size,
    });
    return true;
  }

  return false;
}
