import { environment } from "../../app/config/environment";

/** Minimal Bun/Elysia server surface used for peer IP. */
export type IpServer = {
  requestIP?: (request: Request) => { address: string } | null;
};

type IpSource =
  | Request
  | {
      request: Request;
      server?: IpServer | null;
    };

function getRequest(source: IpSource): Request {
  return source instanceof Request ? source : source.request;
}

function getServer(source: IpSource): IpServer | null | undefined {
  return source instanceof Request ? undefined : source.server;
}

/**
 * Bun often reports IPv4 peers as IPv4-mapped IPv6 (`::ffff:127.0.0.1`).
 * Collapse those to dotted IPv4 for inet columns and logs.
 */
export function canonicalizePeerAddress(address: string): string {
  const trimmed = address.trim();
  const mapped = trimmed.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (mapped?.[1]) return mapped[1];
  // Zone id / brackets sometimes appear — strip for inet.
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed.slice(1, -1).split("%")[0] ?? trimmed;
  }
  return trimmed.split("%")[0] ?? trimmed;
}

function peerIpFromServer(request: Request, server: IpServer | null | undefined): string | undefined {
  if (!server?.requestIP) return undefined;
  const info = server.requestIP(request);
  if (!info?.address) return undefined;
  const address = canonicalizePeerAddress(info.address);
  return address || undefined;
}

/**
 * Resolves the client IP for rate limiting, audit, and session security.
 *
 * When TRUST_PROXY is true, prefer `X-Forwarded-For` / `X-Real-IP` (only when a
 * trusted reverse proxy is configured). Otherwise — and as a fallback when proxy
 * headers are missing — use the TCP peer via Bun `server.requestIP`.
 *
 * Pass `{ request, server }` from Elysia handlers so peer IP works. A bare
 * `Request` cannot resolve the socket and falls back to `"unknown"`.
 *
 * Returns the sentinel `"unknown"` when no IP can be resolved — fine for rate-limit
 * keys, but **not** valid for Postgres `inet` columns. Use {@link normalizeIpForInet}
 * before writing to the DB.
 */
export function getClientIp(source: IpSource): string {
  const request = getRequest(source);
  const server = getServer(source);

  if (environment.TRUST_PROXY) {
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
      const first = forwarded.split(",")[0]?.trim();
      if (first) {
        return canonicalizePeerAddress(first);
      }
    }

    const realIp = request.headers.get("x-real-ip")?.trim();
    if (realIp) {
      return canonicalizePeerAddress(realIp);
    }
  }

  const peer = peerIpFromServer(request, server);
  if (peer) return peer;

  return "unknown";
}

/**
 * Coerce a client-IP string into a value safe for Postgres `inet` columns.
 * `"unknown"`, empty, and clearly non-IP strings become `undefined` (→ NULL).
 */
export function normalizeIpForInet(
  ip: string | null | undefined,
): string | undefined {
  if (ip == null) return undefined;
  const trimmed = canonicalizePeerAddress(ip);
  if (!trimmed || trimmed.toLowerCase() === "unknown") return undefined;

  // Loose IPv4 / IPv6 shape check — full validation is Postgres'; avoid junk casts.
  const ipv4 = /^(?:\d{1,3}\.){3}\d{1,3}$/;
  const ipv6 = /^[0-9a-fA-F:]+$/;
  if (ipv4.test(trimmed) || (trimmed.includes(":") && ipv6.test(trimmed))) {
    return trimmed;
  }
  return undefined;
}
