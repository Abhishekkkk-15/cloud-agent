import type { WebSocket } from "ws";
import { rpcRouter, type ClientRpcRequest } from "./rpc-router.js";
import { daemonHub } from "./daemon-hub.js";
import { findMachineById } from "../db/machine-repo.js";
import type { AuthenticatedUser } from "../auth/jwt.js";

export class ClientHub {
  private userSockets = new Map<string, Set<WebSocket>>();
  private clientSockets = new Map<string, WebSocket>();

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

        // 1. WebRTC Signaling: Client -> Gateway -> Daemon
        if (msg.type === "webrtc.offer" || msg.type === "webrtc.candidate") {
          const { machineId } = msg;
          if (!machineId) {
            ws.send(JSON.stringify({ error: "Missing machineId in WebRTC signal" }));
            return;
          }

          // Security check: verify machine ownership
          const activeSession = daemonHub.getSession(machineId);
          let ownerId: string | undefined = activeSession?.userId;
          if (!ownerId) {
            const doc = await findMachineById(machineId);
            ownerId = doc?.userId;
          }

          if (ownerId !== user.userId && user.role !== "admin") {
            ws.send(JSON.stringify({ error: "Access denied: You do not own this machine." }));
            return;
          }

          // Forward WebRTC signal to target VPS daemon
          daemonHub.sendSignalToDaemon(machineId, {
            type: msg.type,
            clientId,
            sdp: msg.sdp,
            candidate: msg.candidate,
          });
          return;
        }

        // 2. Standard Fallback JSON-RPC over WebSocket
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

  sendSignalToClient(clientId: string, signal: unknown): boolean {
    const ws = this.clientSockets.get(clientId);
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify(signal));
      return true;
    }
    return false;
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
