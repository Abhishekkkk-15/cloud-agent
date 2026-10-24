import { daemonHub } from "./daemon-hub.js";
import { findMachineById } from "../db/machine-repo.js";
import type { AuthenticatedUser } from "../auth/jwt.js";

export interface ClientRpcRequest {
  id: string;
  machineId: string;
  method: string;
  params?: Record<string, unknown>;
}

export class RpcRouter {
  /**
   * Dispatches an RPC command on behalf of an authenticated user to their target VPS machine.
   * Ensures STRICT multi-tenant security: only the owner of the machine can dispatch commands!
   */
  async route(
    user: AuthenticatedUser,
    req: ClientRpcRequest,
    onStream?: (chunk: any) => void
  ): Promise<any> {
    const { machineId, method, params = {} } = req;

    if (!machineId) {
      throw new Error("Missing required field 'machineId'");
    }
    if (!method) {
      throw new Error("Missing required field 'method'");
    }

    // 1. Verify machine ownership in database or active session
    const activeSession = daemonHub.getSession(machineId);
    let ownerId: string | undefined = activeSession?.userId;

    if (!ownerId) {
      const machineDoc = await findMachineById(machineId);
      if (!machineDoc) {
        throw new Error(`Machine [${machineId}] not found`);
      }
      ownerId = machineDoc.userId;
    }

    if (ownerId !== user.userId && user.role !== "admin") {
      throw new Error("Access denied: You do not own this machine.");
    }

    // 2. Dispatch to daemon through DaemonHub
    return daemonHub.sendRpc(machineId, method, params, onStream);
  }
}

export const rpcRouter = new RpcRouter();
