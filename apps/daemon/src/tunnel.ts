import http from "node:http";
import net from "node:net";
import os from "node:os";
import { loadConfig } from "./config.js";

export interface ProxyRequestParams {
  port: number;
  method: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  bodyBase64?: string;
}

export interface ProxyResponseResult {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  bodyBase64: string;
}

/**
 * Proxies a request from Gateway to local 127.0.0.1:<port>
 */
export async function proxyLocalHttp(params: ProxyRequestParams): Promise<ProxyResponseResult> {
  return new Promise((resolve, reject) => {
    const bodyBuf = params.bodyBase64 ? Buffer.from(params.bodyBase64, "base64") : undefined;

    const cleanHeaders = { ...params.headers };
    cleanHeaders.host = `127.0.0.1:${params.port}`;
    if (bodyBuf) {
      cleanHeaders["content-length"] = String(bodyBuf.length);
    }

    const clientReq = http.request(
      {
        hostname: "127.0.0.1",
        port: params.port,
        method: params.method,
        path: params.path,
        headers: cleanHeaders,
        timeout: 15000,
      },
      (clientRes) => {
        const chunks: Buffer[] = [];
        clientRes.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
        clientRes.on("end", () => {
          const resBuf = Buffer.concat(chunks);
          resolve({
            statusCode: clientRes.statusCode || 200,
            headers: clientRes.headers as any,
            bodyBase64: resBuf.toString("base64"),
          });
        });
      }
    );

    clientReq.on("error", (err) => {
      reject(new Error(`Local proxy failed for 127.0.0.1:${params.port}: ${err.message}`));
    });

    clientReq.on("timeout", () => {
      clientReq.destroy();
      reject(new Error(`Local proxy timed out after 15s connecting to 127.0.0.1:${params.port}`));
    });

    if (bodyBuf && bodyBuf.length > 0) {
      clientReq.write(bodyBuf);
    }
    clientReq.end();
  });
}

export function checkPortListening(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host: "127.0.0.1", timeout: 800 });
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("error", () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

export function getLocalIpAddresses(): string[] {
  const interfaces = os.networkInterfaces();
  const addresses: string[] = [];
  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name];
    if (!iface) continue;
    for (const info of iface) {
      if (info.family === "IPv4" && !info.internal) {
        addresses.push(info.address);
      }
    }
  }
  return addresses;
}

export async function exposePort(
  portInput: string | number,
  options: { name?: string; gateway?: string } = {}
): Promise<void> {
  const port = parseInt(String(portInput), 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    console.error(`\x1b[31mError: Invalid port number '${portInput}'. Must be 1 - 65535.\x1b[0m`);
    process.exit(1);
  }

  const isListening = await checkPortListening(port);
  const config = loadConfig();
  const name = options.name || config.machineName || os.hostname();

  console.log(`\n\x1b[1m\x1b[36mCloud Agent — Web Preview & Port Forwarding\x1b[0m`);
  console.log(`  Local Target  : \x1b[1m\x1b[37mhttp://localhost:${port}\x1b[0m`);
  if (isListening) {
    console.log(`  Target Status : \x1b[32m✔ Active (Responding)\x1b[0m`);
  } else {
    console.log(`  Target Status : \x1b[33m⚠️ No local server currently detected on port ${port}\x1b[0m`);
    console.log(`  \x1b[90m(Start your dev server, e.g. 'npm run dev', to view content)\x1b[0m`);
  }

  // 1. Local Wi-Fi Network Access
  const lanIps = getLocalIpAddresses();
  if (lanIps.length > 0) {
    console.log(`\n\x1b[1mLocal Network (Same Wi-Fi) URLs:\x1b[0m`);
    for (const ip of lanIps) {
      const lanUrl = `http://${ip}:${port}`;
      console.log(`  • \x1b[32m${lanUrl}\x1b[0m`);
    }
  }

  // 2. Gateway Ephemeral Tunnel
  const rawGateway = options.gateway || config.gatewayUrl || "https://gateway.cloud-agent.abhishekkkk.in";
  const httpGateway = rawGateway
    .replace(/^wss:\/\//i, "https://")
    .replace(/^ws:\/\//i, "http://")
    .replace(/\/daemon\/ws\/?$/, "");

  console.log(`\n\x1b[90mRegistering remote preview tunnel with Gateway (${httpGateway})...\x1b[0m`);

  try {
    const res = await fetch(`${httpGateway}/api/tunnel/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        machineId: config.machineId,
        port,
        name: `Preview ${name}:${port}`,
      }),
    });

    if (res.ok) {
      const data = (await res.json()) as { previewUrl: string; tunnelId: string };
      console.log(`\n\x1b[1m\x1b[32m✔ Remote Web Preview Tunnel Active!\x1b[0m`);
      console.log(`  Public URL : \x1b[1m\x1b[36m${data.previewUrl}\x1b[0m`);
      console.log(`  Tunnel ID  : \x1b[90m${data.tunnelId}\x1b[0m`);
      console.log(`  Mobile App : Open this URL on your phone browser or scan the QR code below.\n`);

      // Try printing QR code
      try {
        const qrcodeModule = await import("qrcode-terminal");
        const qrcode = (qrcodeModule as any).default || qrcodeModule;
        if (typeof qrcode.generate === "function") {
          qrcode.generate(data.previewUrl, { small: true }, (qr: string) => {
            console.log(qr);
          });
        }
      } catch {}
    } else {
      console.warn(`\x1b[33mRemote tunnel registration returned HTTP ${res.status}: ${await res.text()}\x1b[0m`);
    }
  } catch (err: any) {
    console.warn(`\x1b[33mCould not register remote gateway tunnel: ${err.message}\x1b[0m`);
    console.log(`You can still connect via local network URLs above.`);
  }

  console.log(`\n\x1b[90mEnsure your daemon is running ('ca start') to route incoming web preview requests.\x1b[0m\n`);
}
