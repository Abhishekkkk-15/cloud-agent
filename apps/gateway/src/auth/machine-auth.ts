import crypto from "node:crypto";

export function generateMachineToken(): { token: string; tokenHash: string; tokenPrefix: string } {
  const randomBytes = crypto.randomBytes(32).toString("hex");
  const token = `ca_mach_${randomBytes}`;
  const tokenHash = hashMachineToken(token);
  const tokenPrefix = token.slice(0, 16) + "...";

  return { token, tokenHash, tokenPrefix };
}

export function hashMachineToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
