import { environment } from "../../../../app/config/environment";

/**
 * Public HTTPS accept URL for invite emails.
 * Localhost / private URLs are omitted — they look like phishing to Gmail and
 * are useless on a phone anyway (mobile enters the code manually).
 */
export function resolveInviteAcceptUrl(): string | undefined {
  const base = environment.FRONTEND_URL?.trim();
  if (!base) return undefined;

  let url: URL;
  try {
    url = new URL(base);
  } catch {
    return undefined;
  }

  if (url.protocol !== "https:") return undefined;
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return undefined;
  }

  return `${base.replace(/\/$/, "")}/register`;
}
