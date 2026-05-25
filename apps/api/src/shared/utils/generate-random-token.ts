import { randomBytes } from "node:crypto";

export function generateRandomToken(): string {
  return randomBytes(32).toString("base64url");
}
