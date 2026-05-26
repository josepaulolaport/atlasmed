import type { Role } from "@atlasmed/access";
import { environment } from "../../../../app/config/environment";
import { parseDurationToMs } from "../../../../shared/utils/parse-duration";

const REFRESH_EXPIRATION_MS = parseDurationToMs(environment.JWT_REFRESH_EXPIRATION);

// Optional role caps — session lifetime cannot exceed refresh token policy
export const SESSION_EXPIRY: Record<Role, number> = {
  ADMIN: 4 * 60 * 60 * 1000,
  MANAGER: 8 * 60 * 60 * 1000,
  USER: 24 * 60 * 60 * 1000,
};

export const DEFAULT_SESSION_EXPIRY = 8 * 60 * 60 * 1000;

export function getSessionExpiry(role: Role): number {
  const roleCap = SESSION_EXPIRY[role] || DEFAULT_SESSION_EXPIRY;
  return Math.min(REFRESH_EXPIRATION_MS, roleCap);
}

export function getSessionExpiresAt(role: Role, from: Date = new Date()): Date {
  return new Date(from.getTime() + getSessionExpiry(role));
}
