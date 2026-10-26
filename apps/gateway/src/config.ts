import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config();

export interface GatewayConfig {
  port: number;
  databaseUri: string;
  databaseName: string;
  jwtSecret: string;
  corsOrigin: string;
  googleClientId?: string;
  googleClientSecret?: string;
  googleRedirectUri?: string;
}

export const config: GatewayConfig = {
  port: Number(process.env.PORT || 8080),
  databaseUri: process.env.DATABASE_URI || "mongodb://127.0.0.1:27017",
  databaseName: process.env.DATABASE_NAME || "cloud-agent",
  jwtSecret: process.env.JWT_SECRET || "dev-cloud-agent-jwt-change-me",
  corsOrigin: process.env.CORS_ORIGIN || "*",
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI,
};
