/** DB revalidation interval for cached session/auth rows when Redis stamp is present. */
export const SESSION_STATUS_REVALIDATION_SECONDS = 30;
export const AUTH_STATUS_REVALIDATION_SECONDS = 30;
/** Revoked marker TTL — fail-closed: isMarkedRevoked returns true on Redis errors. */
export const SESSION_REVOKED_MARKER_TTL_SECONDS = 86400;
export const REDIS_CACHE_RETRY_ATTEMPTS = 3;
export const REDIS_CACHE_RETRY_DELAY_MS = 50;
