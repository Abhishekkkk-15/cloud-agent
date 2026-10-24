import dotenv from "dotenv";
dotenv.config();

export interface GatewayConfig {
  port: number;
  databaseUri: string;
  databaseName: string;
  jwtSecret: string;
  corsOrigin: string;
}

export const config: GatewayConfig = {
  port: Number(process.env.PORT || 8080),
  databaseUri: process.env.DATABASE_URI || "mongodb://127.0.0.1:27017",
  databaseName: process.env.DATABASE_NAME || "cloud-agent",
  jwtSecret: process.env.JWT_SECRET || "dev-cloud-agent-jwt-change-me",
  corsOrigin: process.env.CORS_ORIGIN || "*",
};
