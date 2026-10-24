import { rpcDispatcher, type RpcRequest } from "./rpc/index.js";
import { WebRtcPeerManager, type SignalMessage } from "./webrtc.js";
import type { DaemonConfig } from "./config.js";

export class GatewayConnection {
  private ws: WebSocket | null = null;
  private isRunning = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private retryDelayMs = 2000;
  private readonly maxRetryDelayMs = 30000;
  private webrtc: WebRtcPeerManager;

  constructor(private config: DaemonConfig) {
    this.webrtc = new WebRtcPeerManager((signal: SignalMessage) => {
      this.send(signal);
    });
  }

  start(): void {
    this.isRunning = true;
    this.connect();
  }

  stop(): void {
    this.isRunning = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.webrtc.closeAll();
    if (this.ws) {
      try {
        this.ws.close(1000, "Daemon stopped");
      } catch {
        // ignore
      }
      this.ws = null;
    }
  }

  private connect(): void {
    if (!this.isRunning) return;

    const base = this.config.gatewayUrl.replace(/\/$/, "");
    const url = new URL(`${base}/daemon/ws`);
    url.searchParams.set("token", this.config.token);
    url.searchParams.set("machineId", this.config.machineId);
    url.searchParams.set("machineName", this.config.machineName);

    console.log(`[Daemon] Connecting to gateway: ${url.origin}${url.pathname}...`);

    try {
      this.ws = new WebSocket(url.toString());

      this.ws.onopen = () => {
        console.log(`[Daemon] Connected to gateway successfully.`);
        this.retryDelayMs = 2000; // Reset backoff
        this.startHeartbeat();
      };

      this.ws.onmessage = async (event: MessageEvent) => {
        try {
          const raw = typeof event.data === "string" ? event.data : event.data.toString();
          const data = JSON.parse(raw);

          // 1. Handle WebRTC Signaling Messages from Gateway
          if (data.type === "webrtc.offer" && data.clientId && data.sdp) {
            await this.webrtc.handleOffer(data.clientId, data.sdp);
            return;
          }
          if (data.type === "webrtc.candidate" && data.clientId && data.candidate) {
            await this.webrtc.handleCandidate(data.clientId, data.candidate);
            return;
          }
          if (data.type === "webrtc.close" && data.clientId) {
            this.webrtc.closePeer(data.clientId);
            return;
          }

          // 2. Handle standard fallback JSON-RPC over WebSocket
          const req: RpcRequest = data;
          if (req.id && req.method) {
            const res = await rpcDispatcher.handle(req, (streamChunk) => {
              this.send(streamChunk);
            });
            this.send(res);
          }
        } catch (err) {
          console.error(`[Daemon] Error processing message:`, err);
        }
      };

      this.ws.onerror = (err: Event) => {
        const message = "message" in err ? (err as { message: string }).message : "WebSocket error";
        console.warn(`[Daemon] Gateway connection warning:`, message);
      };

      this.ws.onclose = (event) => {
        console.log(`[Daemon] Connection closed (code=${event.code}, reason=${event.reason || "none"}).`);
        this.cleanupConnection();
        this.scheduleReconnect();
      };
    } catch (err) {
      console.error(`[Daemon] Connection error:`, err);
      this.cleanupConnection();
      this.scheduleReconnect();
    }
  }

  private send(data: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(data));
      } catch (err) {
        console.error(`[Daemon] Failed to send message:`, err);
      }
    }
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    const interval = this.config.heartbeatIntervalMs || 15000;

    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({
          type: "heartbeat",
          machineId: this.config.machineId,
          timestamp: new Date().toISOString(),
        });
      }
    }, interval);
  }

  private cleanupConnection(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.ws = null;
  }

  private scheduleReconnect(): void {
    if (!this.isRunning) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    console.log(`[Daemon] Reconnecting in ${this.retryDelayMs / 1000}s...`);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, this.retryDelayMs);

    this.retryDelayMs = Math.min(this.retryDelayMs * 1.5, this.maxRetryDelayMs);
  }
}
