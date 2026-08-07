import { randomInt } from "node:crypto";

/** Six-digit OTP for password reset (email/WhatsApp + mobile code entry). */
export function generatePasswordResetCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}
