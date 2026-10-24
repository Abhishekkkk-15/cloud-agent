import type { WebSocket } from "ws";
import { updateMachineStatus, type MachineDocument } from "../db/machine-repo.js";

export interface DaemonSession {
  machineId: string;
  userId: string;
  name: string;
  ws: WebSocket;
  connectedAt: Date;
  lastPingAt: Date;
}

export interface PendingRpc {
  resolve: (res: any) => void;
  reject: (err: any) => void;
  onStream?: (chunk: any) => void;
  timer?: NodeJS.Timeout;
}

export class DaemonHub {
  private daemons = new Map<string, DaemonSession>();
  private pendingRpcs = new Map<string, PendingRpc>();

  register(
    ws: WebSocket,
    machine: MachineDocument,
    machineIdOverride?: string,
    machineNameOverride?: string
  ): DaemonSession {
    const machineId = machineIdOverride || machine.machineId;
    const name = machineNameOverride || machine.name;

    // Disconnect existing socket if same machineId is already connected
    const existing = this.daemons.get(machineId);
    if (existing && existing.ws !== ws) {
      try {
        existing.ws.close(1000, "Replaced by new connection");
      } catch {
        // ignore
      }
    }

    const session: DaemonSession = {
      machineId,
      userId: machine.userId,
      name,
      ws,
      connectedAt: new Date(),
      lastPingAt: new Date(),
    };

    this.daemons.set(machineId, session);

    // Update status in MongoDB
    updateMachineStatus(machineId, "online", { name }).catch((err) => {
      console.error(`[DaemonHub] Failed to update machine status:`, err);
    });

    console.log(`[DaemonHub] Machine connected: ${name} (${machineId}) for user: ${machine.userId}`);

    // Request daemon status immediately to get adapters & platform info
    this.sendRpc(machineId, "daemon.status", {})
      .then((res) => {
        if (res && res.result) {
          const r = res.result;
          updateMachineStatus(machineId, "online", {
            platform: r.platform,
            arch: r.arch,
            adapters: r.adapters,
          }).catch(() => {});
        }
      })
      .catch(() => {});

    return session;
  }

  unregister(machineId: string): void {
    const session = this.daemons.get(machineId);
    if (session) {
      this.daemons.delete(machineId);
      updateMachineStatus(machineId, "offline").catch(() => {});
      console.log(`[DaemonHub] Machine disconnected: ${session.name} (${machineId})`);
    }
  }

  getSession(machineId: string): DaemonSession | undefined {
    return this.daemons.get(machineId);
  }

  isOnline(machineId: string): boolean {
    const s = this.daemons.get(machineId);
    return s !== undefined && s.ws.readyState === 1; // 1 = OPEN
  }

  handleDaemonMessage(machineId: string, raw: string): void {
    try {
      const data = JSON.parse(raw);

      // Heartbeat ping from daemon
      if (data.type === "heartbeat") {
        const session = this.daemons.get(machineId);
        if (session) {
          session.lastPingAt = new Date();
        }
        return;
      }

      // Check if this is an RPC response or stream chunk
      if (data.id && this.pendingRpcs.has(data.id)) {
        const pending = this.pendingRpcs.get(data.id)!;

        // Streaming chunk
        if (data.stream) {
          if (pending.onStream) {
            pending.onStream(data);
          }
          if (data.done) {
            if (pending.timer) clearTimeout(pending.timer);
            this.pendingRpcs.delete(data.id);
            pending.resolve(data);
          }
          return;
        }

        // Final response
        if (pending.timer) clearTimeout(pending.timer);
        this.pendingRpcs.delete(data.id);

        if (data.error) {
          pending.reject(new Error(data.error));
        } else {
          pending.resolve(data);
        }
      }
    } catch (err) {
      console.error(`[DaemonHub] Error parsing daemon message:`, err);
    }
  }

  /**
   * Dispatches an RPC command to the VPS daemon over WebSocket.
   */
  async sendRpc(
    machineId: string,
    method: string,
    params: Record<string, unknown> = {},
    onStream?: (chunk: any) => void,
    timeoutMs = 60000
  ): Promise<any> {
    const session = this.daemons.get(machineId);
    if (!session || session.ws.readyState !== 1) {
      throw new Error(`Machine [${machineId}] is currently offline or disconnected`);
    }

    const id = `rpc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const payload = JSON.stringify({ id, method, params });

    return new Promise((resolve, reject) => {
      let timer: NodeJS.Timeout | undefined;
      // agent.run is long-running, so don't time out early
      if (method !== "agent.run" && timeoutMs > 0) {
        timer = setTimeout(() => {
          this.pendingRpcs.delete(id);
          reject(new Error(`RPC timeout for method '${method}' on machine [${machineId}]`));
        }, timeoutMs);
      }

      this.pendingRpcs.set(id, { resolve, reject, onStream, timer });

      session.ws.send(payload, (err) => {
        if (err) {
          if (timer) clearTimeout(timer);
          this.pendingRpcs.delete(id);
          reject(err);
        }
      });
    });
  }

  getConnectedCount(): number {
    return this.daemons.size;
  }
}

export const daemonHub = new DaemonHub();
