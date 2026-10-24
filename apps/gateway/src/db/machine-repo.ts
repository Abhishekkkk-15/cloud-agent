import type { Collection, ObjectId } from "mongodb";
import { getDb } from "./mongo.js";
import { generateMachineToken, hashMachineToken } from "../auth/machine-auth.js";

export interface MachineDocument {
  _id?: ObjectId;
  machineId: string;
  userId: string;
  name: string;
  tokenHash: string;
  tokenPrefix: string;
  platform?: string;
  arch?: string;
  adapters?: Array<{
    id: string;
    displayName: string;
    binaryName: string;
  }>;
  status: "online" | "offline";
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export function getMachinesCollection(): Collection<MachineDocument> {
  return getDb().collection<MachineDocument>("machines");
}

export async function createMachineRecord(
  userId: string,
  name: string
): Promise<{ machine: MachineDocument; plainToken: string }> {
  const { token, tokenHash, tokenPrefix } = generateMachineToken();
  const machineId = crypto.randomUUID();
  const now = new Date();

  const doc: MachineDocument = {
    machineId,
    userId,
    name,
    tokenHash,
    tokenPrefix,
    status: "offline",
    lastSeenAt: now,
    createdAt: now,
    updatedAt: now,
  };

  await getMachinesCollection().insertOne(doc);
  return { machine: doc, plainToken: token };
}

export async function findMachineByToken(token: string): Promise<MachineDocument | null> {
  const tokenHash = hashMachineToken(token);
  return getMachinesCollection().findOne({ tokenHash });
}

export async function findMachinesByUserId(
  userId: string
): Promise<Array<Omit<MachineDocument, "tokenHash">>> {
  return getMachinesCollection()
    .find({ userId }, { projection: { tokenHash: 0 } })
    .sort({ updatedAt: -1 })
    .toArray();
}

export async function findMachineById(machineId: string): Promise<MachineDocument | null> {
  return getMachinesCollection().findOne({ machineId });
}

export async function updateMachineStatus(
  machineId: string,
  status: "online" | "offline",
  extra?: Partial<MachineDocument>
): Promise<void> {
  const updateData: Record<string, unknown> = {
    status,
    lastSeenAt: new Date(),
    updatedAt: new Date(),
    ...extra,
  };

  await getMachinesCollection().updateOne({ machineId }, { $set: updateData });
}

export async function deleteMachineRecord(userId: string, machineId: string): Promise<boolean> {
  const res = await getMachinesCollection().deleteOne({ userId, machineId });
  return res.deletedCount > 0;
}
