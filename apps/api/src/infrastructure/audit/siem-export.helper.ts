import type { AuditLog } from "@atlasmed/database";

const PII_KEYS = new Set([
  "email",
  "phoneNumber",
  "phone",
  "identifier",
  "username",
]);

function redactValue(key: string, value: unknown): unknown {
  if (PII_KEYS.has(key) && typeof value === "string") {
    return "[REDACTED]";
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return redactObject(value as Record<string, unknown>);
  }
  return value;
}

function redactObject(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    out[key] = redactValue(key, value);
  }
  return out;
}

export interface SiemAuditEvent {
  id: string;
  timestamp: string;
  eventType: string;
  severity: string;
  action: string;
  actorId: string | null;
  userId: string | null;
  resource: string | null;
  resourceId: string | null;
  sessionId: string | null;
  outcome: string | null;
  ipAddress: string | null;
  details: Record<string, unknown> | null;
}

export function formatAuditLogForSiem(log: AuditLog): SiemAuditEvent {
  const details =
    log.details && typeof log.details === "object"
      ? redactObject(log.details as Record<string, unknown>)
      : null;

  return {
    id: log.id,
    timestamp: log.createdAt.toISOString(),
    eventType: log.eventType,
    severity: log.severity,
    action: log.action,
    actorId: log.actorId,
    userId: log.userId,
    resource: log.resource,
    resourceId: log.resourceId,
    sessionId: log.sessionId,
    outcome: log.outcome,
    ipAddress: log.ipAddress,
    details,
  };
}

export async function postSiemBatch(
  events: SiemAuditEvent[],
  options: { webhookUrl: string; secret?: string }
): Promise<void> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (options.secret) {
    headers["X-SIEM-Secret"] = options.secret;
  }

  const response = await fetch(options.webhookUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      exportedAt: new Date().toISOString(),
      count: events.length,
      events,
    }),
  });

  if (!response.ok) {
    throw new Error(`SIEM webhook returned ${response.status}`);
  }
}
