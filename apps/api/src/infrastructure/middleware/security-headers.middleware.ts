import { Elysia } from "elysia";
import { environment } from "../../app/config/environment";

/**
 * Defense-in-depth HTTP security headers for JSON API responses.
 * Full CSP for the web UI belongs in apps/web (Next.js).
 */
export const securityHeadersPlugin = new Elysia({
  name: "security-headers",
}).onAfterHandle({ as: "global" }, ({ set }) => {
  set.headers["X-Content-Type-Options"] = "nosniff";
  set.headers["X-Frame-Options"] = "DENY";
  set.headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
  set.headers["Permissions-Policy"] =
    "camera=(), microphone=(), geolocation=(), payment=()";
  set.headers["Content-Security-Policy"] = "default-src 'none'";

  if (environment.NODE_ENV === "production") {
    set.headers["Strict-Transport-Security"] =
      "max-age=31536000; includeSubDomains";
  }
});
