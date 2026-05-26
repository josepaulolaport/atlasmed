import { createHash } from "node:crypto";

export function generateDeviceFingerprint(params: {
  userAgent?: string;
  acceptLanguage?: string;
}): string {
  const fingerprint = [params.userAgent ?? "", params.acceptLanguage ?? ""].join("|");

  return createHash("sha256").update(fingerprint).digest("hex").slice(0, 32);
}

export type SessionDeviceIdentity = {
  id: string;
  deviceFingerprint?: string | null;
  userAgent?: string | null;
  deviceType?: string | null;
};

export function sessionsMatchSameDevice(
  a: SessionDeviceIdentity,
  b: SessionDeviceIdentity
): boolean {
  if (
    a.deviceFingerprint &&
    b.deviceFingerprint &&
    a.deviceFingerprint === b.deviceFingerprint
  ) {
    return true;
  }

  if (a.userAgent && b.userAgent) {
    const sameUserAgent = a.userAgent === b.userAgent;
    const sameDeviceType =
      (a.deviceType ?? "UNKNOWN") === (b.deviceType ?? "UNKNOWN");

    if (sameUserAgent && sameDeviceType) {
      return true;
    }
  }

  return a.id === b.id;
}

export function getSessionDeviceKey(session: SessionDeviceIdentity): string {
  if (session.deviceFingerprint) {
    return session.deviceFingerprint;
  }

  if (session.userAgent) {
    return `ua:${session.userAgent}|${session.deviceType ?? "UNKNOWN"}`;
  }

  return `session:${session.id}`;
}
