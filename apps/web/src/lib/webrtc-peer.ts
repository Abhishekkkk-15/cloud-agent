import { getGatewayWsUrl } from "./gateway-api";
import { getAccessToken } from "./http";

export type PeerConnectionState =
  | "idle"
  | "connecting_signaling"
  | "negotiating_webrtc"
  | "p2p_connected"
  | "relay_connected"
  | "disconnected"
  | "error";

interface PendingRpc {
  resolve: (res: any) => void;
  reject: (err: any) => void;
  onStream?: (chunk: any) => void;
  timer?: ReturnType<typeof setTimeout>;
}

export class WebRtcPeerClient {
  readonly machineId: string;
  private gatewayWs: WebSocket | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private assignedClientId = "";
  private pendingRpcs = new Map<string, PendingRpc>();
  private connectionState: PeerConnectionState = "idle";
  private stateChangeListeners = new Set<(state: PeerConnectionState) => void>();

  constructor(machineId: string) {
    this.machineId = machineId;
  }

  getState(): PeerConnectionState {
    return this.connectionState;
  }

  onStateChange(listener: (state: PeerConnectionState) => void): () => void {
    this.stateChangeListeners.add(listener);
    return () => this.stateChangeListeners.delete(listener);
  }

  private setState(state: PeerConnectionState) {
    this.connectionState = state;
    for (const listener of this.stateChangeListeners) {
      listener(state);
    }
  }

  /**
   * Connects to the Gateway for signaling, attempts direct WebRTC P2P DataChannel,
   * and falls back to Gateway WebSocket Relay if NAT traversal fails.
   */
  async connect(): Promise<PeerConnectionState> {
    this.setState("connecting_signaling");
    const token = getAccessToken();
    const wsUrl = `${getGatewayWsUrl()}/client/ws?token=${encodeURIComponent(token || "")}`;

    return new Promise((resolve) => {
      try {
        this.gatewayWs = new WebSocket(wsUrl);

        this.gatewayWs.onopen = () => {
          console.log("[P2P Client] Connected to Gateway signaling WebSocket.");
        };

        this.gatewayWs.onmessage = async (event) => {
          try {
            const msg = JSON.parse(event.data);

            // 1. Initial client registration
            if (msg.type === "client.ready") {
              this.assignedClientId = msg.clientId;
              console.log("[P2P Client] Signaling ready, clientId:", this.assignedClientId);
              this.startWebRtcNegotiation(resolve);
              return;
            }

            // 2. WebRTC Answer from VPS Daemon
            if (msg.type === "webrtc.answer" && msg.sdp && this.peerConnection) {
              console.log("[P2P Client] Received SDP Answer from VPS Daemon.");
              const sdpString = typeof msg.sdp === "string" ? msg.sdp : (msg.sdp as any)?.sdp;
              await this.peerConnection.setRemoteDescription(
                new RTCSessionDescription({ type: "answer", sdp: sdpString })
              );
              return;
            }

            // 3. ICE Candidate from VPS Daemon
            if (msg.type === "webrtc.candidate" && msg.candidate && this.peerConnection) {
              try {
                await this.peerConnection.addIceCandidate(new RTCIceCandidate(msg.candidate));
              } catch (candidateErr) {
                console.warn("[P2P Client] Error adding ICE candidate:", candidateErr);
              }
              return;
            }

            // 4. Fallback WebSocket Relay responses (when P2P is not active)
            this.handleRpcMessage(msg);
          } catch (err) {
            console.error("[P2P Client] Error parsing gateway message:", err);
          }
        };

        this.gatewayWs.onerror = (err) => {
          console.warn("[P2P Client] Gateway socket warning:", err);
        };

        this.gatewayWs.onclose = () => {
          console.log("[P2P Client] Gateway socket closed.");
          if (this.connectionState !== "p2p_connected") {
            this.setState("disconnected");
          }
        };
      } catch (err) {
        console.error("[P2P Client] Failed to connect to gateway:", err);
        this.setState("error");
        resolve("error");
      }
    });
  }

  private async startWebRtcNegotiation(onDone: (state: PeerConnectionState) => void) {
    this.setState("negotiating_webrtc");
    console.log("[P2P Client] Starting WebRTC negotiation with VPS daemon...");

    try {
      this.peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      });

      // Create DataChannel
      this.dataChannel = this.peerConnection.createDataChannel("cloud-agent-rpc");

      this.dataChannel.onopen = () => {
        console.log("🎉 [P2P Client] WebRTC Direct DataChannel is OPEN Peer-to-Peer!");
        this.setState("p2p_connected");
        onDone("p2p_connected");
      };

      this.dataChannel.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleRpcMessage(msg);
        } catch (err) {
          console.error("[P2P Client] Error parsing DataChannel message:", err);
        }
      };

      this.dataChannel.onclose = () => {
        console.log("[P2P Client] WebRTC DataChannel closed.");
        if (this.gatewayWs && this.gatewayWs.readyState === WebSocket.OPEN) {
          this.setState("relay_connected");
        } else {
          this.setState("disconnected");
        }
      };

      // Send local ICE candidates to Daemon via Gateway
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate && this.gatewayWs?.readyState === WebSocket.OPEN) {
          this.gatewayWs.send(
            JSON.stringify({
              type: "webrtc.candidate",
              machineId: this.machineId,
              clientId: this.assignedClientId,
              candidate: event.candidate.toJSON(),
            })
          );
        }
      };

      // Create SDP Offer
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      // Send SDP Offer to Daemon via Gateway
      if (this.gatewayWs?.readyState === WebSocket.OPEN) {
        this.gatewayWs.send(
          JSON.stringify({
            type: "webrtc.offer",
            machineId: this.machineId,
            clientId: this.assignedClientId,
            sdp: offer.sdp,
          })
        );
      }

      // Timeout fallback: If WebRTC DataChannel fails to open in 8s, fall back to Gateway Relay
      setTimeout(() => {
        if (this.connectionState === "negotiating_webrtc") {
          console.warn("[P2P Client] WebRTC P2P timeout. Falling back to Gateway Relay.");
          this.setState("relay_connected");
          onDone("relay_connected");
        }
      }, 8000);
    } catch (err) {
      console.warn("[P2P Client] WebRTC negotiation failed, using relay fallback:", err);
      this.setState("relay_connected");
      onDone("relay_connected");
    }
  }

  private handleRpcMessage(msg: any) {
    if (msg.id && this.pendingRpcs.has(msg.id)) {
      const pending = this.pendingRpcs.get(msg.id)!;

      if (msg.stream) {
        if (pending.onStream) {
          pending.onStream(msg);
        }
        if (msg.done) {
          if (pending.timer) clearTimeout(pending.timer);
          this.pendingRpcs.delete(msg.id);
          pending.resolve(msg.result);
        }
        return;
      }

      if (pending.timer) clearTimeout(pending.timer);
      this.pendingRpcs.delete(msg.id);

      if (msg.error) {
        pending.reject(new Error(msg.error));
      } else {
        pending.resolve(msg.result);
      }
    }
  }

  /**
   * Sends a JSON-RPC request.
   * If P2P is connected: sends directly over WebRTC DataChannel (ZERO server bandwidth).
   * Otherwise: sends via Gateway WebSocket Relay.
   */
  async sendRpc<T = any>(
    method: string,
    params: Record<string, unknown> = {},
    onStream?: (chunk: any) => void
  ): Promise<T> {
    const id = `rpc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const payload = JSON.stringify({
      id,
      machineId: this.machineId,
      method,
      params,
    });

    return new Promise((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      if (method !== "agent.run") {
        timer = setTimeout(() => {
          this.pendingRpcs.delete(id);
          reject(new Error(`RPC timeout for '${method}'`));
        }, 45000);
      }

      this.pendingRpcs.set(id, { resolve, reject, onStream, timer });

      // Direct P2P transmission
      if (this.connectionState === "p2p_connected" && this.dataChannel?.readyState === "open") {
        this.dataChannel.send(payload);
        return;
      }

      // Gateway Relay fallback
      if (this.gatewayWs && this.gatewayWs.readyState === WebSocket.OPEN) {
        this.gatewayWs.send(payload);
        return;
      }

      this.pendingRpcs.delete(id);
      reject(new Error("Not connected to machine (neither P2P nor Gateway relay available)"));
    });
  }

  disconnect() {
    this.setState("disconnected");
    if (this.dataChannel) {
      try {
        this.dataChannel.close();
      } catch {}
      this.dataChannel = null;
    }
    if (this.peerConnection) {
      try {
        this.peerConnection.close();
      } catch {}
      this.peerConnection = null;
    }
    if (this.gatewayWs) {
      try {
        this.gatewayWs.close(1000, "Client disconnected");
      } catch {}
      this.gatewayWs = null;
    }
    this.pendingRpcs.clear();
  }
}
