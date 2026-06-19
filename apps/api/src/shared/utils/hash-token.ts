import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const LEGACY_PREFIX = "sha256:";

function getPepper(): string | undefined {
  const pepper = process.env.TOKEN_HASH_PEPPER?.trim();
  return pepper && pepper.length >= 16 ? pepper : undefined;
}

/** Hash a token for storage. Uses HMAC-SHA256 when TOKEN_HASH_PEPPER is set, else legacy SHA256. */
export function hashToken(token: string): string {
  const pepper = getPepper();

  if (pepper) {
    const digest = createHmac("sha256", pepper).update(token).digest("hex");
    return `hmac:${digest}`;
  }

  return `${LEGACY_PREFIX}${createHash("sha256").update(token).digest("hex")}`;
}

/** Compare a raw token against a stored hash (supports legacy and HMAC formats). */
export function verifyTokenHash(token: string, storedHash: string): boolean {
  if (storedHash.startsWith("hmac:")) {
    const pepper = getPepper();
    if (!pepper) {
      return false;
    }
    const expected = createHmac("sha256", pepper).update(token).digest("hex");
    const actual = storedHash.slice(5);
    if (expected.length !== actual.length) {
      return false;
    }
    return timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
  }

  const legacy = storedHash.startsWith(LEGACY_PREFIX)
    ? storedHash.slice(LEGACY_PREFIX.length)
    : storedHash;
  const computed = createHash("sha256").update(token).digest("hex");

  if (legacy.length !== computed.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(legacy), Buffer.from(computed));
}
