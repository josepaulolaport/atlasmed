import type { Role } from "@atlasmed/access";

// Session expiry durations in milliseconds
export const SESSION_EXPIRY: Record<Role, number> = {
  ADMIN: 4 * 60 * 60 * 1000, // 4 hours (shorter for privileged access)
  MANAGER: 8 * 60 * 60 * 1000, // 8 hours
  USER: 24 * 60 * 60 * 1000, // 24 hours
};

// Default if role not found
export const DEFAULT_SESSION_EXPIRY = 8 * 60 * 60 * 1000; // 8 hours

export function getSessionExpiry(role: Role): number {
  return SESSION_EXPIRY[role] || DEFAULT_SESSION_EXPIRY;
}
