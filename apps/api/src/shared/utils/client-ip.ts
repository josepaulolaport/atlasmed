import { environment } from "../../app/config/environment";

type IpSource = Request | { request: Request };

function getRequest(source: IpSource): Request {
  return source instanceof Request ? source : source.request;
}

/**
 * Resolves the client IP for rate limiting, audit, and session security.
 *
 * When TRUST_PROXY is false (default), forwarded headers are ignored so clients
 * cannot spoof IP by sending X-Forwarded-For directly to the app.
 * Enable TRUST_PROXY only when a trusted reverse proxy strips/forwards headers.
 */
export function getClientIp(source: IpSource): string {
  const request = getRequest(source);

  if (environment.TRUST_PROXY) {
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
      const first = forwarded.split(",")[0]?.trim();
      if (first) {
        return first;
      }
    }

    const realIp = request.headers.get("x-real-ip")?.trim();
    if (realIp) {
      return realIp;
    }
  }

  return "unknown";
}
