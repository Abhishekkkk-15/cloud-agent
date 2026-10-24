import { create } from "zustand";
import {
  fetchUserMachines,
  createMachineToken,
  deleteUserMachine,
  type RemoteMachine,
  type CreateMachineTokenResult,
} from "@/lib/gateway-api";
import { WebRtcPeerClient, type PeerConnectionState } from "@/lib/webrtc-peer";

interface MachinesState {
  machines: RemoteMachine[];
  activeMachineId: string | null;
  activeConnectionState: PeerConnectionState;
  peerClient: WebRtcPeerClient | null;
  loading: boolean;
  error: string | null;

  fetchMachines: () => Promise<void>;
  createToken: (name?: string) => Promise<CreateMachineTokenResult>;
  deleteMachine: (machineId: string) => Promise<void>;
  connectToMachine: (machineId: string) => Promise<PeerConnectionState>;
  disconnectFromMachine: () => void;
}

export const useMachinesStore = create<MachinesState>((set, get) => ({
  machines: [],
  activeMachineId: null,
  activeConnectionState: "idle",
  peerClient: null,
  loading: false,
  error: null,

  fetchMachines: async () => {
    set({ loading: true, error: null });
    try {
      const machines = await fetchUserMachines();
      set({ machines, loading: false });
    } catch (err) {
      set({
        error: (err as Error).message || "Failed to load machines",
        loading: false,
      });
    }
  },

  createToken: async (name?: string) => {
    set({ loading: true, error: null });
    try {
      const result = await createMachineToken(name);
      await get().fetchMachines();
      set({ loading: false });
      return result;
    } catch (err) {
      set({
        error: (err as Error).message || "Failed to generate token",
        loading: false,
      });
      throw err;
    }
  },

  deleteMachine: async (machineId: string) => {
    try {
      if (get().activeMachineId === machineId) {
        get().disconnectFromMachine();
      }
      await deleteUserMachine(machineId);
      await get().fetchMachines();
    } catch (err) {
      set({ error: (err as Error).message || "Failed to delete machine" });
      throw err;
    }
  },

  connectToMachine: async (machineId: string) => {
    const existing = get().peerClient;
    if (existing) {
      existing.disconnect();
    }

    const client = new WebRtcPeerClient(machineId);
    set({
      activeMachineId: machineId,
      peerClient: client,
      activeConnectionState: client.getState(),
    });

    client.onStateChange((state) => {
      set({ activeConnectionState: state });
    });

    const finalState = await client.connect();
    return finalState;
  },

  disconnectFromMachine: () => {
    const client = get().peerClient;
    if (client) {
      client.disconnect();
    }
    set({
      activeMachineId: null,
      peerClient: null,
      activeConnectionState: "disconnected",
    });
  },
}));
