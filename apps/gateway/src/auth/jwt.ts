import jwt from "jsonwebtoken";
import { config } from "../config.js";

export interface AuthenticatedUser {
  userId: string;
  email?: string;
  role?: string;
}

export function verifyUserJwt(token: string): AuthenticatedUser | null {
  try {
    const cleanToken = token.replace(/^Bearer\s+/i, "").trim();
    const decoded = jwt.verify(cleanToken, config.jwtSecret, { algorithms: ["HS256"] }) as jwt.JwtPayload;

    if (!decoded || !decoded.sub) {
      return null;
    }

    return {
      userId: String(decoded.sub),
      email: decoded.email as string | undefined,
      role: (decoded.role as string) || "user",
    };
  } catch {
    return null;
  }
}
