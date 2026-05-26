import { environment } from "../../../../app/config/environment";
import { parseDurationToMs } from "../../../../shared/utils/parse-duration";

/** Refresh cookie maxAge aligned with JWT_REFRESH_EXPIRATION. SameSite=strict mitigates CSRF for cookie-only refresh. */
export function getRefreshCookieMaxAgeSeconds(): number {
  const ms = parseDurationToMs(environment.JWT_REFRESH_EXPIRATION);
  return Math.floor(ms / 1000);
}

export function getRefreshCookieOptions(value: string) {
  return {
    value,
    httpOnly: true,
    secure: environment.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: getRefreshCookieMaxAgeSeconds(),
  };
}
