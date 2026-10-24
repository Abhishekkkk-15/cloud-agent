import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, WebSocket } from "ws";
import { findMachineByToken } from "../db/machine-repo.js";
import { verifyUserJwt } from "../auth/jwt.js";
import { daemonHub } from "../hub/daemon-hub.js";
import { clientHub } from "../hub/client-hub.js";

export const daemonWss = new WebSocketServer({ noServer: true });
export const clientWss = new WebSocketServer({ noServer: true });

export function setupWebSocketUpgrades(server: import("node:http").Server): void {
  server.on("upgrade", async (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    try {
      const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
      const pathname = url.pathname;

      // 1. Daemon Outbound WebSocket: /daemon/ws
      if (pathname === "/daemon/ws") {
        const token = url.searchParams.get("token");
        const machineId = url.searchParams.get("machineId") || undefined;
        const machineName = url.searchParams.get("machineName") || undefined;

        if (!token) {
          socket.write("HTTP/1.1 401 Unauthorized\r\n\r\nMissing token parameter");
          socket.destroy();
          return;
        }

        const machine = await findMachineByToken(token);
        if (!machine) {
          socket.write("HTTP/1.1 401 Unauthorized\r\n\r\nInvalid machine token");
          socket.destroy();
          return;
        }

        daemonWss.handleUpgrade(req, socket, head, (ws: WebSocket) => {
          const session = daemonHub.register(ws, machine, machineId, machineName);

          ws.on("message", (data) => {
            const raw = typeof data === "string" ? data : data.toString();
            daemonHub.handleDaemonMessage(session.machineId, raw);
          });

          ws.on("close", () => {
            daemonHub.unregister(session.machineId);
          });

          ws.on("error", (err) => {
            console.error(`[DaemonWSS] Socket error on machine [${session.machineId}]:`, err);
          });
        });
        return;
      }

      // 2. Client Web/Mobile WebSocket: /client/ws
      if (pathname === "/client/ws") {
        const token = url.searchParams.get("token") || req.headers["authorization"];
        if (!token) {
          socket.write("HTTP/1.1 401 Unauthorized\r\n\r\nMissing user authentication token");
          socket.destroy();
          return;
        }

        const user = verifyUserJwt(token);
        if (!user) {
          socket.write("HTTP/1.1 401 Unauthorized\r\n\r\nInvalid or expired JWT token");
          socket.destroy();
          return;
        }

        clientWss.handleUpgrade(req, socket, head, (ws: WebSocket) => {
          clientHub.register(ws, user);
        });
        return;
      }

      // Not recognized
      socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
      socket.destroy();
    } catch (err) {
      console.error("[WebSocket Upgrade Error]", err);
      socket.destroy();
    }
  });
}
