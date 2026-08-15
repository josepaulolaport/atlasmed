/** DB revalidation interval for cached session/auth rows when Redis stamp is present. */
export const SESSION_STATUS_REVALIDATION_SECONDS = 30;
export const AUTH_STATUS_REVALIDATION_SECONDS = 30;
/** Revoked marker TTL — fail-closed: isMarkedRevoked returns true on Redis errors. */
export const SESSION_REVOKED_MARKER_TTL_SECONDS = 86400;
export const REDIS_CACHE_RETRY_ATTEMPTS = 3;
export const REDIS_CACHE_RETRY_DELAY_MS = 50;
/**
 * How often a session's `last_seen_at` is refreshed (spec 0015 §4.1).
 *
 * The column existed but nothing ever wrote it, so it held the moment the
 * session was created and read as "logged in once, long ago" for someone using
 * the app daily. Touching it on every authenticated request would be a write
 * per request for a field nobody reads to the minute; five minutes is precise
 * enough to answer "is this person still using it" and costs one write per
 * session per window.
 */
export const SESSION_LAST_SEEN_THROTTLE_SECONDS = 300;
