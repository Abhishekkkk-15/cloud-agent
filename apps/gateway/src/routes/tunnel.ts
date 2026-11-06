import type { IncomingMessage, ServerResponse } from "node:http";
import crypto from "node:crypto";
import { daemonHub } from "../hub/daemon-hub.js";

export interface ActiveTunnel {
  tunnelId: string;
  machineId: string;
  port: number;
  name: string;
  createdAt: number;
}

const activeTunnels = new Map<string, ActiveTunnel>();

// Cleanup stale tunnels after 24 hours
setInterval(() => {
  const now = Date.now();
  for (const [id, t] of activeTunnels.entries()) {
    if (now - t.createdAt > 24 * 60 * 60 * 1000) {
      activeTunnels.delete(id);
    }
  }
}, 60 * 60 * 1000);

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
  res.end(JSON.stringify(data));
}

export async function handleTunnelRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL
): Promise<boolean> {
  const method = req.method || "GET";
  const pathname = url.pathname;

  // CORS Preflight
  if (method === "OPTIONS" && (pathname.startsWith("/api/tunnel") || pathname.startsWith("/preview"))) {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    });
    res.end();
    return true;
  }

  // 1. Register Tunnel: POST /api/tunnel/register
  if (method === "POST" && (pathname === "/api/tunnel/register" || pathname === "/tunnel/register")) {
    let bodyText = "";
    for await (const chunk of req) {
      bodyText += chunk;
    }

    try {
      const body = JSON.parse(bodyText || "{}");
      const port = parseInt(body.port, 10);
      const machineId = String(body.machineId || "");
      const name = String(body.name || `Port ${port}`);

      if (isNaN(port) || port < 1 || port > 65535) {
        sendJson(res, 400, { error: "Invalid port number. Must be between 1 and 65535." });
        return true;
      }

      if (!machineId) {
        sendJson(res, 400, { error: "Missing machineId." });
        return true;
      }

      // Check if machine is connected
      const isOnline = daemonHub.isOnline(machineId);
      if (!isOnline) {
        // Still register, but warn
      }

      const tunnelId = crypto.randomBytes(4).toString("hex");
      const host = req.headers.host || "localhost:8080";
      const proto = (req.headers["x-forwarded-proto"] as string) || (host.includes("localhost") ? "http" : "https");

      const previewUrl = `${proto}://${host}/preview/${tunnelId}/`;

      const tunnel: ActiveTunnel = {
        tunnelId,
        machineId,
        port,
        name,
        createdAt: Date.now(),
      };

      activeTunnels.set(tunnelId, tunnel);

      console.log(`[Gateway Tunnel] Registered tunnel '${tunnelId}' for machine ${machineId} on port ${port}`);

      sendJson(res, 200, {
        success: true,
        tunnelId,
        port,
        previewUrl,
        machineId,
      });
      return true;
    } catch (err: any) {
      sendJson(res, 400, { error: `Failed to register tunnel: ${err.message}` });
      return true;
    }
  }

  // 2. List Tunnels: GET /api/tunnel/list
  if (method === "GET" && (pathname === "/api/tunnel/list" || pathname === "/tunnel/list")) {
    const machineId = url.searchParams.get("machineId");
    let list = Array.from(activeTunnels.values());
    if (machineId) {
      list = list.filter((t) => t.machineId === machineId);
    }
    sendJson(res, 200, { tunnels: list });
    return true;
  }

  // 3. Close Tunnel: DELETE /api/tunnel/:tunnelId
  if (method === "DELETE" && pathname.startsWith("/api/tunnel/")) {
    const tunnelId = pathname.slice("/api/tunnel/".length).trim();
    if (activeTunnels.has(tunnelId)) {
      activeTunnels.delete(tunnelId);
      sendJson(res, 200, { success: true, message: "Tunnel closed." });
    } else {
      sendJson(res, 404, { error: "Tunnel not found." });
    }
    return true;
  }

  // 4. Preview Proxy: /preview/:tunnelId/*
  if (pathname.startsWith("/preview/")) {
    const parts = pathname.slice("/preview/".length).split("/");
    const tunnelId = parts[0];
    const subpath = "/" + parts.slice(1).join("/");

    const tunnel = activeTunnels.get(tunnelId);
    if (!tunnel) {
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`<!DOCTYPE html><html><body style="font-family:sans-serif;background:#0d1117;color:#f0f6fc;text-align:center;padding:50px;">
        <h2>404 - Web Preview Tunnel Not Found</h2>
        <p style="color:#8b949e;">The tunnel '${tunnelId}' may have expired or was closed.</p>
        <p><a href="/" style="color:#0077b6;">Return Home</a></p>
      </body></html>`);
      return true;
    }

    const isOnline = daemonHub.isOnline(tunnel.machineId);
    if (!isOnline) {
      res.writeHead(502, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`<!DOCTYPE html><html><body style="font-family:sans-serif;background:#0d1117;color:#f0f6fc;text-align:center;padding:50px;">
        <h2>502 - Machine Offline</h2>
        <p style="color:#8b949e;">The host machine running this preview is currently offline.</p>
      </body></html>`);
      return true;
    }

    // Read client body if present
    const bodyChunks: Buffer[] = [];
    for await (const chunk of req) {
      bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const reqBodyBase64 = bodyChunks.length > 0 ? Buffer.concat(bodyChunks).toString("base64") : undefined;

    try {
      // Forward request to daemon over RPC
      const rpcResponse: any = await daemonHub.sendRpc(tunnel.machineId, "tunnel.proxy_request", {
        port: tunnel.port,
        method: req.method || "GET",
        path: subpath + (url.search || ""),
        headers: req.headers,
        bodyBase64: reqBodyBase64,
      });

      const rpcResult = rpcResponse?.result;

      if (!rpcResult) {
        throw new Error("No response from daemon proxy.");
      }

      const statusCode = rpcResult.statusCode || 200;
      const headers = rpcResult.headers || {};
      const resBody = rpcResult.bodyBase64 ? Buffer.from(rpcResult.bodyBase64, "base64") : Buffer.from("");

      // Remove hop-by-hop headers
      delete headers["transfer-encoding"];
      delete headers["content-length"];

      res.writeHead(statusCode, {
        ...headers,
        "Content-Length": resBody.length,
        "Access-Control-Allow-Origin": "*",
      });
      res.end(resBody);
      return true;
    } catch (err: any) {
      res.writeHead(502, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`<!DOCTYPE html><html><body style="font-family:sans-serif;background:#0d1117;color:#f0f6fc;text-align:center;padding:50px;">
        <h2>502 - Bad Gateway to Local Port ${tunnel.port}</h2>
        <p style="color:#8b949e;">${err.message}</p>
        <p style="color:#6e7681;font-size:12px;">Make sure your local dev server is running on port ${tunnel.port}.</p>
      </body></html>`);
      return true;
    }
  }

  return false;
}
