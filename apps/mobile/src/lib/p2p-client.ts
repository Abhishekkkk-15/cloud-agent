export type ConnectionState = 'disconnected' | 'connecting' | 'signaling' | 'connected' | 'error';

export interface RpcResponse<T = any> {
  id: string;
  result?: T;
  error?: { code?: number; message?: string } | string;
}

export interface DaemonStatusResult {
  hostname: string;
  platform: string;
  arch: string;
  uptime: number;
  pid?: number;
  nodeVersion?: string;
  telemetry?: {
    cpu?: {
      percent: number;
      cores: number;
      model: string;
      speedMhz: number;
    };
    ram?: {
      totalGb: number;
      usedGb: number;
      freeGb: number;
      percent: number;
    };
    disk?: {
      totalGb: number;
      usedGb: number;
      freeGb: number;
      percent: number;
    } | null;
    loadAvg?: number[];
  };
  adapters?: Array<{
    id: string;
    displayName?: string;
    name?: string;
    version?: string;
    binaryName?: string;
    binaryPath?: string;
    status?: 'active' | 'ready' | 'installed' | 'unavailable';
  }>;
  availability?: Record<string, {
    available: boolean;
    version?: string;
    binaryPath?: string;
  }>;
}

export class MobileP2PClient {
  private ws: WebSocket | null = null;
  private pc: any | null = null;
  private dc: any | null = null;
  private state: ConnectionState = 'disconnected';
  private clientId: string = '';
  private machineId: string = '';
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
    this.machineId = machineId;
    this.setState('connecting');

    try {
      // Normalize protocol to ws/wss
      const wsBase = gatewayUrl.replace(/^http:\/\//i, 'ws://').replace(/^https:\/\//i, 'wss://');
      const wsUrl = `${wsBase}/client/ws?token=${token}`;
      console.log('[MobileP2P] Connecting WebSocket to:', wsUrl);
      this.ws = new WebSocket(wsUrl);

      await new Promise<void>((resolve, reject) => {
        if (!this.ws) return reject(new Error('WebSocket creation failed'));
        this.ws.onopen = () => {
          console.log('[MobileP2P] WebSocket opened to Gateway');
          resolve();
        };
        this.ws.onerror = (e) => {
          console.error('[MobileP2P] WebSocket error:', e);
          reject(e);
        };
      });

      this.setState('signaling');

      // Use native RTCPeerConnection if available
      const RTCPC = typeof window !== 'undefined' && (window as any).RTCPeerConnection
        ? (window as any).RTCPeerConnection
        : typeof globalThis !== 'undefined' && (globalThis as any).RTCPeerConnection
        ? (globalThis as any).RTCPeerConnection
        : null;

      if (RTCPC) {
        try {
          this.pc = new RTCPC({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
          });

          this.dc = this.pc.createDataChannel('cloud-agent-rpc');

          this.pc.onicecandidate = (event: any) => {
            if (event.candidate && this.ws && this.ws.readyState === WebSocket.OPEN) {
              this.ws.send(JSON.stringify({
                type: 'webrtc.candidate',
                machineId: this.machineId,
                clientId: this.clientId,
                candidate: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate,
              }));
            }
          };

          this.dc.onopen = () => {
            console.log('[MobileP2P] WebRTC DataChannel OPENED!');
            this.setState('connected');
          };
          this.dc.onclose = () => {
            console.log('[MobileP2P] DataChannel closed');
          };
          this.dc.onmessage = (event: any) => {
            this.handleIncomingMessage(event.data);
          };
        } catch (e) {
          console.warn('[MobileP2P] RTCPeerConnection setup failed, falling back to WebSocket relay:', e);
        }
      }

      this.ws.onmessage = async (msg: any) => {
        try {
          const rawText = typeof msg.data === 'string' ? msg.data : msg.data.toString();
          const data = JSON.parse(rawText);

          if (data.type === 'client.ready') {
            this.clientId = data.clientId;
            console.log('[MobileP2P] Client ready with ID:', this.clientId);

            // Once client is registered, mark as connected
            this.setState('connected');

            if (this.pc) {
              try {
                const offer = await this.pc.createOffer();
                await this.pc.setLocalDescription(offer);

                this.ws?.send(JSON.stringify({
                  type: 'webrtc.offer',
                  machineId: this.machineId,
                  clientId: this.clientId,
                  sdp: offer,
                }));
              } catch (offerErr) {
                console.warn('[MobileP2P] Failed to create WebRTC offer:', offerErr);
              }
            }
          } else if (data.type === 'webrtc.answer' && data.sdp && this.pc) {
            const sdpString = typeof data.sdp === 'string' ? data.sdp : data.sdp.sdp;
            await this.pc.setRemoteDescription({ type: 'answer', sdp: sdpString });
          } else if (data.type === 'webrtc.candidate' && data.candidate && this.pc) {
            const RTCCand = (window as any)?.RTCIceCandidate || (globalThis as any)?.RTCIceCandidate;
            try {
              await this.pc.addIceCandidate(RTCCand ? new RTCCand(data.candidate) : data.candidate);
            } catch {
              // ignore duplicate candidate
            }
          } else {
            // Handle RPC response or stream chunk
            this.handleIncomingMessage(rawText);
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

      // Handle streaming chunks (e.g. agent.run)
      if (data.stream) {
        if (data.event) {
          this.eventListeners.forEach((listener) => listener(data.event));
        }
        if (data.done && data.id && this.pendingRpcs.has(data.id)) {
          const handler = this.pendingRpcs.get(data.id)!;
          this.pendingRpcs.delete(data.id);
          handler.resolve(data.result);
        }
        return;
      }

      // Deliver general background events
      if (data.event) {
        this.eventListeners.forEach((listener) => listener(data.event));
      }

      // Handle final RPC response
      if (data.id && this.pendingRpcs.has(data.id)) {
        const handler = this.pendingRpcs.get(data.id)!;
        this.pendingRpcs.delete(data.id);
        if (data.error) {
          handler.reject(new Error(typeof data.error === 'string' ? data.error : data.error.message || 'RPC Failed'));
        } else {
          handler.resolve(data.result);
        }
      }
    } catch (err) {
      console.error('[MobileP2PClient] Failed to handle incoming message:', err);
    }
  }

  sendRpc<T = any>(method: string, params: Record<string, unknown> = {}, timeoutMs?: number): Promise<T> {
    const id = `rpc_${++this.reqCounter}_${Date.now()}`;
    const payload = JSON.stringify({ id, machineId: this.machineId, method, params });

    return new Promise<T>((resolve, reject) => {
      this.pendingRpcs.set(id, { resolve, reject });

      // Generous timeout for AI agent runs (3 minutes), 30s for standard RPCs
      const effectiveTimeout = timeoutMs !== undefined
        ? timeoutMs
        : method === 'agent.run'
        ? 180000
        : 30000;

      if (effectiveTimeout > 0) {
        setTimeout(() => {
          if (this.pendingRpcs.has(id)) {
            this.pendingRpcs.delete(id);
            reject(new Error(`RPC timeout for method ${method}`));
          }
        }, effectiveTimeout);
      }

      if (this.dc && this.dc.readyState === 'open') {
        this.dc.send(payload);
      } else if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(payload);
      } else {
        this.pendingRpcs.delete(id);
        reject(new Error('No active connection to Gateway or Daemon'));
      }
    });
  }

  getMachineId(): string {
    return this.machineId;
  }

  async switchMachine(newMachineId: string): Promise<void> {
    if (this.machineId === newMachineId) return;
    this.machineId = newMachineId;
    console.log('[MobileP2P] Switched active machineId to:', newMachineId);

    // Close previous DataChannel/PeerConnection so we cleanly reset or re-negotiate
    if (this.pc) {
      try {
        this.dc?.close();
        this.pc?.close();
      } catch {
        // ignore
      }
      this.dc = null;
      this.pc = null;
    }

    // Attempt WebRTC re-negotiation with the new machine over the open Gateway WS
    const RTCPC = typeof window !== 'undefined' && (window as any).RTCPeerConnection
      ? (window as any).RTCPeerConnection
      : typeof globalThis !== 'undefined' && (globalThis as any).RTCPeerConnection
      ? (globalThis as any).RTCPeerConnection
      : null;

    if (RTCPC && this.ws && this.ws.readyState === WebSocket.OPEN && this.clientId) {
      try {
        this.pc = new RTCPC({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        });

        this.dc = this.pc.createDataChannel('cloud-agent-rpc');

        this.pc.onicecandidate = (event: any) => {
          if (event.candidate && this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
              type: 'webrtc.candidate',
              machineId: this.machineId,
              clientId: this.clientId,
              candidate: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate,
            }));
          }
        };

        this.dc.onopen = () => {
          console.log('[MobileP2P] WebRTC DataChannel OPENED for switched machine:', newMachineId);
        };
        this.dc.onmessage = (event: any) => {
          this.handleIncomingMessage(event.data);
        };

        const offer = await this.pc.createOffer();
        await this.pc.setLocalDescription(offer);

        this.ws.send(JSON.stringify({
          type: 'webrtc.offer',
          machineId: this.machineId,
          clientId: this.clientId,
          sdp: offer,
        }));
      } catch (e) {
        console.warn('[MobileP2P] WebRTC re-negotiation on machine switch failed, falling back to Gateway WS relay:', e);
      }
    }
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
