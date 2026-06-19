/** Concurrent refresh losers may present the just-superseded hash briefly. */
export const REFRESH_ROTATION_GRACE_MS = 10_000;

export function isWithinRefreshRotationGrace(updatedAt: Date, now = Date.now()): boolean {
  return now - updatedAt.getTime() < REFRESH_ROTATION_GRACE_MS;
}
