import type { IncomingMessage, ServerResponse } from "node:http";
import fs from "node:fs";
import path from "node:path";
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

// Token store with lightweight JSON file persistence to survive server restarts (Zero-DB compliant)
const tokenRegistry = new Map<string, RegisteredDevice>(); // pushToken -> RegisteredDevice
const userTokens = new Map<string, Set<string>>(); // userId -> Set<pushToken>
const machineTokens = new Map<string, Set<string>>(); // machineId -> Set<pushToken>

const TOKENS_CACHE_FILE = path.resolve(process.cwd(), ".tokens-registry.json");

function loadTokensFromDisk(): void {
  try {
    if (fs.existsSync(TOKENS_CACHE_FILE)) {
      const raw = fs.readFileSync(TOKENS_CACHE_FILE, "utf-8");
      const list = JSON.parse(raw) as RegisteredDevice[];
      for (const d of list) {
        tokenRegistry.set(d.token, d);
        if (!userTokens.has(d.userId)) userTokens.set(d.userId, new Set());
        userTokens.get(d.userId)!.add(d.token);
        if (d.machineId) {
          if (!machineTokens.has(d.machineId)) machineTokens.set(d.machineId, new Set());
          machineTokens.get(d.machineId)!.add(d.token);
        }
      }
      console.log(`[PushRegistry] Restored ${list.length} push token(s) from persistent disk cache.`);
    }
  } catch (err) {
    console.warn("[PushRegistry] Could not load tokens from disk cache:", err);
  }
}

function saveTokensToDisk(): void {
  try {
    const list = Array.from(tokenRegistry.values());
    fs.writeFileSync(TOKENS_CACHE_FILE, JSON.stringify(list, null, 2), "utf-8");
  } catch (err) {
    console.warn("[PushRegistry] Could not save tokens to disk cache:", err);
  }
}

// Initial restore on gateway boot
loadTokensFromDisk();

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

  saveTokensToDisk();
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
    saveTokensToDisk();
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
  let tokens = Array.from(machineTokens.get(machineId) || []);
  if (tokens.length === 0) {
    // Fallback: If no machine-specific subscription, broadcast to all registered devices on this gateway
    tokens = Array.from(tokenRegistry.keys());
  }
  if (tokens.length === 0) {
    console.log(`[PushRegistry] notifyMachineSubscribers: No registered devices found for machine=${machineId}`);
    return [];
  }

  console.log(`[PushRegistry] Delivering push to ${tokens.length} device(s) for machine=${machineId}: "${message.title}"`);
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
      } else if (tokenRegistry.size > 0) {
        // Fallback: Test dispatch to all registered devices on this gateway
        targetTokens.push(...Array.from(tokenRegistry.keys()));
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
      devices: Array.from(tokenRegistry.values()).map((d) => ({
        tokenMasked: `${d.token.slice(0, 16)}...${d.token.slice(-6)}`,
        userId: d.userId,
        machineId: d.machineId || null,
        platform: d.platform,
        registeredAt: d.registeredAt,
        lastActiveAt: d.lastActiveAt,
      })),
    });
    return true;
  }

  return false;
}
