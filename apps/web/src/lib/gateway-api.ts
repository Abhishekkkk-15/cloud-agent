import { getAccessToken } from "./http";

export interface RemoteMachine {
  machineId: string;
  name: string;
  tokenPrefix: string;
  platform?: string;
  arch?: string;
  adapters?: Array<{
    id: string;
    displayName: string;
    binaryName: string;
  }>;
  status: "online" | "offline";
  isOnline: boolean;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMachineTokenResult {
  machineId: string;
  name: string;
  token: string;
  tokenPrefix: string;
  installCommand: string;
  instructions: string;
}

export function getGatewayBaseUrl(): string {
  const url = import.meta.env.VITE_GATEWAY_URL || "http://localhost:8080";
  return url.replace(/\/$/, "");
}

export function getGatewayWsUrl(): string {
  const base = getGatewayBaseUrl();
  return base.replace(/^http:/, "ws:").replace(/^https:/, "wss:");
}

export async function fetchUserMachines(): Promise<RemoteMachine[]> {
  const token = getAccessToken();
  const res = await fetch(`${getGatewayBaseUrl()}/api/machines`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to fetch machines (${res.status})`);
  }

  const data = await res.json();
  return data.machines || [];
}

export async function createMachineToken(name?: string): Promise<CreateMachineTokenResult> {
  const token = getAccessToken();
  const res = await fetch(`${getGatewayBaseUrl()}/api/machines/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ name }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to create machine token (${res.status})`);
  }

  return res.json();
}

export async function deleteUserMachine(machineId: string): Promise<void> {
  const token = getAccessToken();
  const res = await fetch(`${getGatewayBaseUrl()}/api/machines/${machineId}`, {
    method: "DELETE",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to delete machine (${res.status})`);
  }
}
