import { Elysia } from "elysia";
import { auditLogService } from "./audit-log.service";
import { resolveAuditEvent } from "./event-type-map";
import { getClientIp } from "../../shared/utils/client-ip";
import { environment } from "../../app/config/environment";

/**
 * Elysia plugin that automatically writes an audit log entry after every
 * mutating request handled by an authenticated route.
 *
 * Must be applied AFTER the auth plugin so that `getAuthContext` is available
 * in the request context. The `onAfterHandle` lifecycle runs only when the
 * handler completes without throwing, so failed/unauthorized requests are not
 * recorded here (they are handled separately by logFailedLoginAttempt etc.).
 *
 * Design notes:
 * - Fire-and-forget: audit writes never block or delay the HTTP response.
 * - GET requests are skipped by default (not in the event-type map).
 * - Routes not in the map are silently skipped; they can be added incrementally.
 * - Does NOT duplicate anything into Pino logs or OTEL traces — those are
 *   separate concerns with different audiences and retention policies.
 */
export const auditMiddleware = new Elysia({ name: "audit-middleware" }).onAfterHandle(
  { as: "scoped" },
  (ctx) => {
    if (!environment.ENABLE_AUDIT_LOG) return;

    const { request } = ctx;
    const path = new URL(request.url).pathname;
    const method = request.method;

    const event = resolveAuditEvent(method, path);
    if (!event) return;

    const getAuthContext =
      "getAuthContext" in ctx
        ? (ctx.getAuthContext as () => Promise<{
            userId: number;
            sessionId: number;
          }>)
        : null;

    if (!getAuthContext) return;

    const ipAddress = getClientIp(ctx);
    const userAgent = request.headers.get("user-agent") ?? undefined;

    const params =
      "params" in ctx && ctx.params != null
        ? (ctx.params as Record<string, string>)
        : {};

    const resourceId =
      params["id"] ??
      params["personId"] ??
      params["personFacilityId"] ??
      params["facilityId"] ??
      params["territoryId"] ??
      undefined;

    void getAuthContext()
      .then((authCtx) =>
        auditLogService.log({
          userId: authCtx.userId,
          eventType: event.eventType,
          severity: event.severity ?? "INFO",
          actorId: authCtx.userId,
          action: `${method.toLowerCase()} ${path}`,
          resource: event.eventType.split(".")[0]?.toLowerCase(),
          resourceId,
          sessionId: authCtx.sessionId,
          ipAddress,
          userAgent,
          outcome: "SUCCESS",
        })
      )
      .catch(() => {
        // Audit failures must never crash the application or leak to the client.
      });
  }
);
