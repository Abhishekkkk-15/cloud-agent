import type { WebSocket } from "ws";
import { rpcRouter, type ClientRpcRequest } from "./rpc-router.js";
import type { AuthenticatedUser } from "../auth/jwt.js";

export class ClientHub {
  private userSockets = new Map<string, Set<WebSocket>>();
  private clientSockets = new Map<string, WebSocket>();

  constructor() {
    // Keep alive all connected client sockets across proxies (Render/Cloudflare/NAT)
    setInterval(() => {
      for (const ws of this.clientSockets.values()) {
        if (ws.readyState === 1) {
          try {
            ws.ping();
          } catch {
            // ignore
          }
        }
      }
    }, 25000);
  }

  register(ws: WebSocket, user: AuthenticatedUser): void {
    if (!this.userSockets.has(user.userId)) {
      this.userSockets.set(user.userId, new Set());
    }
    this.userSockets.get(user.userId)!.add(ws);

    const defaultClientId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this.clientSockets.set(defaultClientId, ws);

    console.log(`[ClientHub] User client connected: ${user.userId} (clientId: ${defaultClientId})`);

    // Notify client of their assigned clientId
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({ type: "client.ready", clientId: defaultClientId }));
    }

    ws.on("message", async (data: Buffer | string) => {
      try {
        const raw = typeof data === "string" ? data : data.toString();
        const msg = JSON.parse(raw);

        const clientId = msg.clientId || defaultClientId;
        if (!this.clientSockets.has(clientId)) {
          this.clientSockets.set(clientId, ws);
        }

        // 0. Heartbeat Ping from Mobile/Web Client
        if (msg.type === "ping" || msg.type === "heartbeat") {
          if (ws.readyState === 1) {
            ws.send(JSON.stringify({ type: "pong", timestamp: msg.timestamp || Date.now() }));
          }
          return;
        }

        // 1. Standard JSON-RPC over WebSocket
        const req: ClientRpcRequest = msg;
        if (!req.id) {
          ws.send(JSON.stringify({ error: "Missing 'id' in request" }));
          return;
        }

        try {
          const res = await rpcRouter.route(user, req, (streamChunk) => {
            if (ws.readyState === 1) {
              ws.send(
                JSON.stringify({
                  id: req.id,
                  stream: true,
                  event: streamChunk.event,
                  done: streamChunk.done,
                })
              );
            }
          });

          if (ws.readyState === 1) {
            ws.send(JSON.stringify({ id: req.id, result: res.result }));
          }
        } catch (routeErr) {
          if (ws.readyState === 1) {
            ws.send(
              JSON.stringify({
                id: req.id,
                error: (routeErr as Error).message || String(routeErr),
              })
            );
          }
        }
      } catch (err) {
        console.error(`[ClientHub] Error handling client message:`, err);
      }
    });

    ws.on("close", () => {
      this.clientSockets.delete(defaultClientId);
      const set = this.userSockets.get(user.userId);
      if (set) {
        set.delete(ws);
        if (set.size === 0) {
          this.userSockets.delete(user.userId);
        }
      }
      console.log(`[ClientHub] User client disconnected: ${user.userId}`);
    });
  }

  broadcastToUser(userId: string, data: unknown): void {
    const sockets = this.userSockets.get(userId);
    if (!sockets) return;
    const payload = JSON.stringify(data);
    for (const ws of sockets) {
      if (ws.readyState === 1) {
        ws.send(payload);
      }
    }
  }

  broadcastAll(data: unknown): void {
    const payload = JSON.stringify(data);
    for (const ws of this.clientSockets.values()) {
      if (ws.readyState === 1) {
        ws.send(payload);
      }
    }
  }
}

export const clientHub = new ClientHub();
