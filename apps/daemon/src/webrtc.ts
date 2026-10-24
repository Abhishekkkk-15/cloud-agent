import { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate, type RTCDataChannel } from "werift";
import { rpcDispatcher } from "./rpc/index.js";

export interface SignalMessage {
  type: "webrtc.offer" | "webrtc.answer" | "webrtc.candidate";
  clientId: string;
  sdp?: string;
  candidate?: any;
}

export class WebRtcPeerManager {
  private peers = new Map<string, RTCPeerConnection>();

  constructor(private sendSignal: (msg: SignalMessage) => void) {}

  async handleOffer(clientId: string, sdpOffer: string): Promise<void> {
    console.log(`[WebRTC P2P] Received SDP Offer from client [${clientId}]`);

    // Clean up existing peer if re-connecting
    this.closePeer(clientId);

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });

    this.peers.set(clientId, pc);

    pc.onIceCandidate.subscribe((candidate) => {
      if (candidate) {
        this.sendSignal({
          type: "webrtc.candidate",
          clientId,
          candidate: candidate.toJSON ? candidate.toJSON() : candidate,
        });
      }
    });

    pc.onDataChannel.subscribe((channel: RTCDataChannel) => {
      console.log(`[WebRTC P2P] DataChannel opened: '${channel.label}' with client [${clientId}]`);

      channel.onMessage.subscribe(async (msg) => {
        try {
          const raw = typeof msg === "string" ? msg : msg.toString();
          const req = JSON.parse(raw);

          // Execute RPC directly on the VPS and stream results back over the P2P DataChannel!
          const res = await rpcDispatcher.handle(req, (streamChunk) => {
            if (channel.readyState === "open") {
              channel.send(JSON.stringify(streamChunk));
            }
          });

          if (channel.readyState === "open") {
            channel.send(JSON.stringify(res));
          }
        } catch (err) {
          console.error(`[WebRTC P2P] Error handling RPC request:`, err);
          if (channel.readyState === "open") {
            channel.send(JSON.stringify({ error: (err as Error).message || String(err) }));
          }
        }
      });

      channel.stateChange.subscribe((state) => {
        console.log(`[WebRTC P2P] DataChannel state change: ${state}`);
      });
    });

    const sdpString =
      typeof sdpOffer === "string"
        ? sdpOffer
        : (sdpOffer as any)?.sdp || String(sdpOffer);

    await pc.setRemoteDescription(new RTCSessionDescription(sdpString, "offer"));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    // Send SDP Answer back through Gateway signaling
    this.sendSignal({
      type: "webrtc.answer",
      clientId,
      sdp: answer.sdp,
    });
    console.log(`[WebRTC P2P] Sent SDP Answer to client [${clientId}]`);
  }

  async handleCandidate(clientId: string, candidateData: any): Promise<void> {
    const pc = this.peers.get(clientId);
    if (pc && candidateData) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidateData));
      } catch (err) {
        console.warn(`[WebRTC P2P] Error adding ICE candidate:`, err);
      }
    }
  }

  closePeer(clientId: string): void {
    const pc = this.peers.get(clientId);
    if (pc) {
      try {
        pc.close();
      } catch {
        // ignore
      }
      this.peers.delete(clientId);
      console.log(`[WebRTC P2P] Closed peer connection with client [${clientId}]`);
    }
  }

  closeAll(): void {
    for (const [clientId, pc] of this.peers.entries()) {
      try {
        pc.close();
      } catch {
        // ignore
      }
    }
    this.peers.clear();
  }
}
