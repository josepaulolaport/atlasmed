import { randomInt } from "node:crypto";

/** Unambiguous alphabet (no 0/O, 1/I/L) for human-typed invite codes. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Default length: 8 chars ≈ 40 bits of entropy with the 32-char alphabet. */
const DEFAULT_LENGTH = 8;

/**
 * Short invite code for email/WhatsApp display (not a URL-safe session token).
 * Always uppercase; callers should normalize user input the same way before hashing.
 */
export function generateInviteCode(length = DEFAULT_LENGTH): string {
  if (length < 6 || length > 16) {
    throw new Error("Invite code length must be between 6 and 16");
  }

  let code = "";
  for (let i = 0; i < length; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)]!;
  }
  return code;
}

/** Normalize pasted invite codes (case, spaces, dashes) before lookup/hash. */
export function normalizeInviteCode(raw: string): string {
  return raw.trim().replace(/[\s-]/g, "").toUpperCase();
}
