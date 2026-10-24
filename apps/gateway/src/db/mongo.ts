import { MongoClient, type Db } from "mongodb";
import { config } from "../config.js";

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectMongo(): Promise<Db> {
  if (db && client) {
    return db;
  }

  try {
    client = new MongoClient(config.databaseUri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });

    await client.connect();
    db = client.db(config.databaseName);
    console.log(`[Mongo] Connected to database: ${config.databaseName}`);

    // Create indexes for machines collection
    const machinesCol = db.collection("machines");
    await machinesCol.createIndex({ tokenHash: 1 }, { unique: true });
    await machinesCol.createIndex({ userId: 1, machineId: 1 });

    return db;
  } catch (err) {
    console.warn(`[Mongo] Connection warning: Could not connect to MongoDB at ${config.databaseUri}. Operating in offline/fallback mode. Error:`, (err as Error).message);
    throw err;
  }
}

export function getDb(): Db {
  if (!db) {
    throw new Error("MongoDB has not been initialized. Call connectMongo() first.");
  }
  return db;
}

export async function closeMongo(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log("[Mongo] Connection closed.");
  }
}
