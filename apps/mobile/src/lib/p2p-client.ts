import { networkMonitor } from './network';
import type { CliCapabilities } from '@cloud-agent/cli-interface';

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
  capabilities?: CliCapabilities;
}

interface PendingRpcEntry {
  resolve: (val: any) => void;
  reject: (err: any) => void;
  timer?: any;
  resetTimer?: () => void;
  isLongRunning?: boolean;
}

export class MobileP2PClient {
  private ws: WebSocket | null = null;
  private pc: any | null = null;
  private dc: any | null = null;
  private state: ConnectionState = 'disconnected';
  private clientId: string = '';
  private machineId: string = '';
  private pendingRpcs = new Map<string, PendingRpcEntry>();
  private eventListeners = new Set<(event: any) => void>();
  private stateListeners = new Set<(state: ConnectionState) => void>();
  private reqCounter = 0;
  private lastGatewayUrl = '';
  private lastToken = '';
  private reconnectTimer: any = null;
  private reconnectAttempts = 0;
  private isExplicitlyDisconnected = false;
  private heartbeatTimer: any = null;
  private lastPongAt = Date.now();

  constructor() {}

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.lastPongAt = Date.now();

    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
        } catch (e) {
          console.warn('[MobileP2P] Failed to send heartbeat ping:', e);
        }

        // If no pong or message received for >40 seconds, socket is zombie -> force reconnect
        if (Date.now() - this.lastPongAt > 40000) {
          console.warn('[MobileP2P] Heartbeat timeout (>40s without pong/activity). Force reconnecting...');
          this.stopHeartbeat();
          try {
            this.ws.close();
          } catch {}
          this.setState('disconnected');
          this.scheduleReconnect();
        }
      }
    }, 15000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

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
    this.lastGatewayUrl = gatewayUrl;
    this.lastToken = token;
    this.machineId = machineId;
    this.isExplicitlyDisconnected = false;
    networkMonitor.setGatewayUrl(gatewayUrl);
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
          this.reconnectAttempts = 0;
          this.lastPongAt = Date.now();
          this.startHeartbeat();
          if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
          }
          resolve();
        };
        this.ws.onerror = (e) => {
          console.error('[MobileP2P] WebSocket error:', e);
          this.stopHeartbeat();
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

          this.lastPongAt = Date.now();
          if (data.type === 'pong' || data.type === 'heartbeat') {
            return;
          }

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
        console.log('[MobileP2P] WebSocket closed by gateway/host');
        this.stopHeartbeat();
        this.setState('disconnected');

        // Fail pending RPCs with connection error so callers do not hang
        for (const [id, entry] of this.pendingRpcs.entries()) {
          if (entry.timer) clearTimeout(entry.timer);
          entry.reject(new Error('Connection closed mid-flight'));
        }
        this.pendingRpcs.clear();

        if (!this.isExplicitlyDisconnected) {
          this.scheduleReconnect();
        }
      };
    } catch (err) {
      console.error('[MobileP2PClient] Connection error:', err);
      this.stopHeartbeat();
      this.setState('error');
      networkMonitor.checkConnectivity().catch(() => {});
      if (!this.isExplicitlyDisconnected) {
        this.scheduleReconnect();
      }
    }
  }

  private handleIncomingMessage(rawText: string) {
    try {
      const data = JSON.parse(rawText);

      // Handle streaming chunks (e.g. agent.run, agent.subscribe)
      if (data.stream) {
        if (data.id && this.pendingRpcs.has(data.id)) {
          const handler = this.pendingRpcs.get(data.id)!;
          // Crucial: reset inactivity watchdog so long tasks never get killed while streaming
          handler.resetTimer?.();
          if (data.done) {
            if (handler.timer) clearTimeout(handler.timer);
            this.pendingRpcs.delete(data.id);
            handler.resolve(data.result);
          }
        }
        if (data.event) {
          this.eventListeners.forEach((listener) => listener(data.event));
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
        if (handler.timer) clearTimeout(handler.timer);
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

  sendRpc<T = any>(method: string, params: Record<string, unknown> = {}, timeoutMs?: number, customId?: string): Promise<T> {
    const id = customId || `rpc_${++this.reqCounter}_${Date.now()}`;
    const payload = JSON.stringify({ id, machineId: this.machineId, method, params });

    const isLongRunning =
      method === 'agent.run' ||
      method === 'agent.subscribe' ||
      method === 'sessions.subscribe' ||
      method === 'terminal.exec';

    return new Promise<T>((resolve, reject) => {
      let timer: any = null;

      const resetTimer = () => {
        if (timer) clearTimeout(timer);
        // For long running tasks (AI turns, continuous stream subscriptions):
        // 5-minute inactivity watchdog that resets on every incoming stream chunk.
        // For standard RPC queries (daemon.status, sessions.list): 30 seconds.
        const timeout = timeoutMs !== undefined
          ? timeoutMs
          : isLongRunning
          ? 300000 // 5 minutes inactivity watchdog
          : 30000;  // 30 seconds standard

        if (timeout > 0) {
          timer = setTimeout(() => {
            if (this.pendingRpcs.has(id)) {
              this.pendingRpcs.delete(id);
              reject(new Error(`RPC timeout for method ${method} (inactivity)`));
            }
          }, timeout);
        }
      };

      resetTimer();

      this.pendingRpcs.set(id, { resolve, reject, timer, resetTimer, isLongRunning });

      if (this.dc && this.dc.readyState === 'open') {
        this.dc.send(payload);
      } else if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(payload);
      } else {
        if (timer) clearTimeout(timer);
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

  private scheduleReconnect(): void {
    if (this.isExplicitlyDisconnected || !this.lastGatewayUrl || !this.lastToken) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    // Jittered exponential backoff: 1.5s, 3s, 6s, 10s max (+ 0-500ms jitter)
    const baseDelay = Math.min(1500 * Math.pow(1.5, this.reconnectAttempts), 10000);
    const jitter = Math.floor(Math.random() * 500);
    const delay = baseDelay + jitter;
    this.reconnectAttempts++;

    console.log(`[MobileP2P] Disconnected. Reconnecting in ${Math.round(delay)}ms (attempt #${this.reconnectAttempts})`);
    this.reconnectTimer = setTimeout(() => {
      if (this.state === 'disconnected' || this.state === 'error') {
        this.connect(this.lastGatewayUrl, this.lastToken, this.machineId).catch(() => {});
      }
    }, delay);
  }

  reconnectNow(): void {
    if (this.isExplicitlyDisconnected || !this.lastGatewayUrl || !this.lastToken) return;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = 0;
    if (this.state !== 'connected' && this.state !== 'connecting') {
      console.log('[MobileP2P] Reconnecting immediately...');
      this.connect(this.lastGatewayUrl, this.lastToken, this.machineId).catch(() => {});
    }
  }

  isConnected(): boolean {
    return this.state === 'connected';
  }

  disconnect() {
    this.isExplicitlyDisconnected = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    for (const [id, entry] of this.pendingRpcs.entries()) {
      if (entry.timer) clearTimeout(entry.timer);
      entry.reject(new Error('P2P Client explicitly disconnected'));
    }
    this.pendingRpcs.clear();
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
