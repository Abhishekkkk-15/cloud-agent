import type { WebSocket } from "ws";
import { rpcRouter, type ClientRpcRequest } from "./rpc-router.js";
import type { AuthenticatedUser } from "../auth/jwt.js";

export class ClientHub {
  private userSockets = new Map<string, Set<WebSocket>>();

  register(ws: WebSocket, user: AuthenticatedUser): void {
    if (!this.userSockets.has(user.userId)) {
      this.userSockets.set(user.userId, new Set());
    }
    this.userSockets.get(user.userId)!.add(ws);

    console.log(`[ClientHub] User client connected: ${user.userId}`);

    ws.on("message", async (data: Buffer | string) => {
      try {
        const raw = typeof data === "string" ? data : data.toString();
        const req: ClientRpcRequest = JSON.parse(raw);

        if (!req.id) {
          ws.send(JSON.stringify({ error: "Missing 'id' in request" }));
          return;
        }

        try {
          const res = await rpcRouter.route(user, req, (streamChunk) => {
            // Forward live streaming chunks back to this client
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
}

export const clientHub = new ClientHub();
