import { environment } from "../../../../app/config/environment";
import { parseDurationToMs } from "../../../../shared/utils/parse-duration";

/**
 * How long a session survives without being used.
 *
 * The window slides: every refresh moves it forward, so this is an idle
 * timeout rather than a session lifetime. There is deliberately no absolute
 * cap — a user who opens the app regularly is never asked to log in again.
 *
 * It used to be shortened per role (ADMIN 4h, MANAGER 8h, OPS 12h, REP 24h).
 * Every product surface is the mobile app now, and the effect of the gradient
 * was that the most privileged users — the ones who close the app overnight
 * and open it in the morning — were the only ones logged out daily. Refresh
 * tokens rotate with reuse detection, which is what actually bounds a stolen
 * token's usefulness.
 */
export const SESSION_IDLE_EXPIRY_MS = parseDurationToMs(
  environment.JWT_REFRESH_EXPIRATION,
);

export function getSessionExpiresAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + SESSION_IDLE_EXPIRY_MS);
}
