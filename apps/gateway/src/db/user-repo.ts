import { ObjectId } from "mongodb";
import { getDb } from "./mongo.js";

export interface UserDoc {
  _id?: ObjectId;
  name: string;
  email: string;
  username: string;
  password?: string | null;
  google_id?: string | null;
  avatar_url?: string | null;
  plan: "free" | "hacker" | "pro";
  role: "user" | "admin";
  is_active: boolean;
  is_verified: boolean;
  created_at: Date;
  updated_at: Date;
}

export async function upsertGoogleUser(profile: {
  googleId: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
}): Promise<UserDoc> {
  const db = getDb();
  const users = db.collection<UserDoc>("users");

  const normalizedEmail = profile.email.toLowerCase().trim();
  const existing = await users.findOne({
    $or: [{ google_id: profile.googleId }, { email: normalizedEmail }],
  });

  const now = new Date();

  if (existing) {
    const updateFields: Partial<UserDoc> = {
      updated_at: now,
      google_id: profile.googleId,
    };
    if (profile.name && (!existing.name || existing.name === existing.email)) {
      updateFields.name = profile.name;
    }
    if (profile.avatarUrl) {
      updateFields.avatar_url = profile.avatarUrl;
    }
    await users.updateOne({ _id: existing._id }, { $set: updateFields });
    return { ...existing, ...updateFields };
  }

  const baseUsername =
    normalizedEmail.split("@")[0].replace(/[^a-z0-9-]/g, "-").slice(0, 80) || "user";
  const newUser: UserDoc = {
    name: profile.name || baseUsername,
    email: normalizedEmail,
    username: baseUsername,
    google_id: profile.googleId,
    avatar_url: profile.avatarUrl || null,
    plan: "free",
    role: "user",
    is_active: true,
    is_verified: true,
    created_at: now,
    updated_at: now,
  };

  const res = await users.insertOne(newUser as any);
  return { ...newUser, _id: res.insertedId };
}

export async function getOrCreateDevUser(): Promise<UserDoc> {
  const db = getDb();
  const users = db.collection<UserDoc>("users");

  // Match existing primary user in DB first (e.g. test@example.com) so all paired machines are immediately accessible
  const existingTestUser = await users.findOne({ email: "test@example.com" });
  if (existingTestUser) return existingTestUser;

  const existingDev = await users.findOne({ email: "developer@cloud-agent.internal" });
  if (existingDev) return existingDev;

  const firstUser = await users.findOne({});
  if (firstUser) return firstUser;

  const now = new Date();
  const devUser: UserDoc = {
    name: "Developer",
    email: "test@example.com",
    username: "developer",
    google_id: null,
    avatar_url: null,
    plan: "pro",
    role: "admin",
    is_active: true,
    is_verified: true,
    created_at: now,
    updated_at: now,
  };

  const res = await users.insertOne(devUser as any);
  return { ...devUser, _id: res.insertedId };
}

export async function findUserById(id: string): Promise<UserDoc | null> {
  if (!ObjectId.isValid(id)) return null;
  const db = getDb();
  return db.collection<UserDoc>("users").findOne({ _id: new ObjectId(id) });
}
