export type ConnectionState = 'disconnected' | 'connecting' | 'signaling' | 'connected' | 'error';

export interface RpcResponse<T = any> {
  id: string;
  result?: T;
  error?: { code: number; message: string };
}

export interface DaemonStatusResult {
  status: string;
  uptime: number;
  pid: number;
  platform: string;
  arch: string;
  hostname: string;
  adapters: Array<{
    id: string;
    name: string;
    version: string;
    binaryPath: string;
    isPrimary?: boolean;
    status: 'active' | 'ready' | 'installed' | 'unavailable';
  }>;
  telemetry?: {
    cpuPercent: number;
    ramUsedGb: number;
    ramTotalGb: number;
    diskUsedGb: number;
    diskTotalGb: number;
    loadAvg: [number, number, number];
    egressMbps: number;
    ingressKbps: number;
  };
}

export class MobileP2PClient {
  private ws: WebSocket | null = null;
  private pc: any | null = null;
  private dc: any | null = null;
  private state: ConnectionState = 'disconnected';
  private clientId: string = '';
  private pendingRpcs = new Map<string, { resolve: (val: any) => void; reject: (err: any) => void }>();
  private eventListeners = new Set<(event: any) => void>();
  private stateListeners = new Set<(state: ConnectionState) => void>();
  private reqCounter = 0;

  constructor() {}

  getState(): ConnectionState {
    return this.state;
  }

  private setState(newState: ConnectionState) {
    this.state = newState;
    this.stateListeners.forEach((listener) => listener(newState));
  }

  onStateChange(cb: (state: ConnectionState) => void): () => void {
    this.stateListeners.add(cb);
    cb(this.state);
    return () => this.stateListeners.delete(cb);
  }

  onEvent(cb: (event: any) => void): () => void {
    this.eventListeners.add(cb);
    return () => this.eventListeners.delete(cb);
  }

  async connect(gatewayUrl: string, token: string, machineId: string): Promise<void> {
    if (this.state === 'connected' || this.state === 'connecting') return;
    this.setState('connecting');

    try {
      const wsUrl = `${gatewayUrl}/client/ws?token=${token}`;
      this.ws = new WebSocket(wsUrl);

      await new Promise<void>((resolve, reject) => {
        if (!this.ws) return reject(new Error('WebSocket creation failed'));
        this.ws.onopen = () => resolve();
        this.ws.onerror = (e) => reject(e);
      });

      this.setState('signaling');

      // Use native RTCPeerConnection if available (in browser Expo Web or react-native-webrtc)
      const RTCPC = typeof window !== 'undefined' && (window as any).RTCPeerConnection
        ? (window as any).RTCPeerConnection
        : typeof globalThis !== 'undefined' && (globalThis as any).RTCPeerConnection
        ? (globalThis as any).RTCPeerConnection
        : null;

      if (RTCPC) {
        this.pc = new RTCPC({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        });

        this.dc = this.pc.createDataChannel('cloud-agent-rpc');

        this.pc.onicecandidate = (event: any) => {
          if (event.candidate && this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
              type: 'webrtc.candidate',
              machineId,
              clientId: this.clientId,
              candidate: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate,
            }));
          }
        };

        const setupDc = (channel: any) => {
          channel.onopen = () => {
            this.setState('connected');
          };
          channel.onclose = () => {
            this.setState('disconnected');
          };
          channel.onmessage = (event: any) => {
            this.handleIncomingMessage(event.data);
          };
        };

        setupDc(this.dc);
      }

      this.ws.onmessage = async (msg: any) => {
        try {
          const data = JSON.parse(typeof msg.data === 'string' ? msg.data : msg.data.toString());

          if (data.type === 'client.ready') {
            this.clientId = data.clientId;

            if (this.pc) {
              const offer = await this.pc.createOffer();
              await this.pc.setLocalDescription(offer);

              this.ws?.send(JSON.stringify({
                type: 'webrtc.offer',
                machineId,
                clientId: this.clientId,
                sdp: offer,
              }));
            } else {
              // Direct WebSocket relay mode if RTCPeerConnection is not available
              this.setState('connected');
            }
          } else if (data.type === 'webrtc.answer' && data.sdp && this.pc) {
            const RTCSD = (window as any)?.RTCSessionDescription || (globalThis as any)?.RTCSessionDescription;
            const sdpString = typeof data.sdp === 'string' ? data.sdp : data.sdp.sdp;
            await this.pc.setRemoteDescription(new RTCSD({ type: 'answer', sdp: sdpString }));
          } else if (data.type === 'webrtc.candidate' && data.candidate && this.pc) {
            const RTCCand = (window as any)?.RTCIceCandidate || (globalThis as any)?.RTCIceCandidate;
            try {
              await this.pc.addIceCandidate(new RTCCand(data.candidate));
            } catch {
              // ignore duplicate candidate
            }
          } else if (data.type === 'rpc.response' || data.result !== undefined || data.error !== undefined) {
            this.handleIncomingMessage(JSON.stringify(data));
          } else if (data.type === 'agent.event') {
            this.eventListeners.forEach((listener) => listener(data.event));
          }
        } catch (err) {
          console.error('[MobileP2PClient] Error parsing gateway message:', err);
        }
      };

      this.ws.onclose = () => {
        this.setState('disconnected');
      };
    } catch (err) {
      console.error('[MobileP2PClient] Connection error:', err);
      this.setState('error');
    }
  }

  private handleIncomingMessage(rawText: string) {
    try {
      const data = JSON.parse(rawText);
      if (data.id && this.pendingRpcs.has(data.id)) {
        const handler = this.pendingRpcs.get(data.id)!;
        this.pendingRpcs.delete(data.id);
        if (data.error) {
          handler.reject(new Error(data.error.message || 'RPC Failed'));
        } else {
          handler.resolve(data.result);
        }
      } else if (data.event) {
        this.eventListeners.forEach((listener) => listener(data.event));
      }
    } catch (err) {
      console.error('[MobileP2PClient] Failed to handle incoming message:', err);
    }
  }

  sendRpc<T = any>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const id = `mobile_rpc_${++this.reqCounter}_${Date.now()}`;
    const payload = JSON.stringify({ id, method, params });

    return new Promise<T>((resolve, reject) => {
      this.pendingRpcs.set(id, { resolve, reject });

      // Timeout after 15 seconds
      setTimeout(() => {
        if (this.pendingRpcs.has(id)) {
          this.pendingRpcs.delete(id);
          reject(new Error(`RPC timeout for method ${method}`));
        }
      }, 15000);

      if (this.dc && this.dc.readyState === 'open') {
        this.dc.send(payload);
      } else if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'rpc.relay',
          payload,
        }));
      } else {
        this.pendingRpcs.delete(id);
        reject(new Error('No active connection to Daemon'));
      }
    });
  }

  disconnect() {
    this.dc?.close();
    this.pc?.close();
    this.ws?.close();
    this.dc = null;
    this.pc = null;
    this.ws = null;
    this.setState('disconnected');
  }
}

export const mobileP2P = new MobileP2PClient();
