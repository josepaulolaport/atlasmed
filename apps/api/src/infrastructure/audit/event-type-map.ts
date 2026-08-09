/**
 * Maps HTTP method + normalized route path to a DOMAIN.ACTION audit event type.
 *
 * Convention: DOMAIN.ACTION — domain is uppercase, action is uppercase.
 * GET requests are generally not audited (read-only), except for sensitive exports.
 *
 * Returns null for routes that should not generate an audit record (e.g., read-only GETs).
 */

type EventEntry = {
  eventType: string;
  severity?: "INFO" | "WARNING" | "CRITICAL";
};

type RouteKey = `${string} ${string}`;

const routeMap: Record<RouteKey, EventEntry> = {
  // --- Auth ---
  "POST /api/v1/auth/login": { eventType: "USER.LOGIN" },
  "POST /api/v1/auth/logout": { eventType: "USER.LOGOUT" },
  "POST /api/v1/auth/refresh": { eventType: "USER.SESSION_REFRESH" },
  "POST /api/v1/auth/login/2fa": { eventType: "USER.LOGIN_2FA" },

  // --- Password ---
  "POST /api/v1/auth/password-reset": { eventType: "USER.PASSWORD_RESET_REQUEST", severity: "WARNING" },
  "POST /api/v1/auth/password-reset/confirm": { eventType: "USER.PASSWORD_RESET_COMPLETE", severity: "WARNING" },
  "POST /api/v1/users/:id/change-password": { eventType: "USER.PASSWORD_CHANGE", severity: "WARNING" },

  // --- 2FA ---
  "POST /api/v1/users/:id/2fa/setup": { eventType: "USER.2FA_SETUP" },
  "POST /api/v1/users/:id/2fa/confirm": { eventType: "USER.2FA_ENABLE", severity: "WARNING" },
  "DELETE /api/v1/users/:id/2fa": { eventType: "USER.2FA_DISABLE", severity: "WARNING" },

  // --- Sessions ---
  "DELETE /api/v1/sessions/:id": { eventType: "USER.SESSION_REVOKE" },
  "DELETE /api/v1/sessions": { eventType: "USER.SESSIONS_REVOKE_ALL" },

  // --- Users ---
  "PATCH /api/v1/users/:id/activate": { eventType: "USER.ACTIVATE" },
  "PATCH /api/v1/users/:id/deactivate": { eventType: "USER.DEACTIVATE", severity: "WARNING" },
  "PATCH /api/v1/users/:id/suspend": { eventType: "USER.SUSPEND", severity: "WARNING" },
  "PATCH /api/v1/users/:id/unsuspend": { eventType: "USER.UNSUSPEND" },
  "PUT /api/v1/users/:id/territory": { eventType: "USER.TERRITORY_ASSIGNED" },
  "DELETE /api/v1/users/:id/territory/:territoryId": { eventType: "USER.TERRITORY_REVOKED" },
  // --- Invitations ---
  "POST /api/v1/invitations": { eventType: "USER.INVITE" },
  "POST /api/v1/invitations/:id/accept": { eventType: "USER.ACCEPT_INVITE" },
  "POST /api/v1/invitations/:id/resend": { eventType: "USER.INVITE_RESEND" },
  "DELETE /api/v1/invitations/:id": { eventType: "USER.INVITE_REVOKE", severity: "WARNING" },

  // --- Facilities ---
  "POST /api/v1/facilities": { eventType: "FACILITY.CREATED" },
  "PUT /api/v1/facilities/:id": { eventType: "FACILITY.UPDATED" },
  "PATCH /api/v1/facilities/:id": { eventType: "FACILITY.UPDATED" },
  "DELETE /api/v1/facilities/:id": { eventType: "FACILITY.DEACTIVATED", severity: "WARNING" },

  // --- Territories ---
  "POST /api/v1/territories": { eventType: "TERRITORY.CREATED" },
  "PUT /api/v1/territories/:id": { eventType: "TERRITORY.UPDATED" },
  "PATCH /api/v1/territories/:id": { eventType: "TERRITORY.UPDATED" },
  "DELETE /api/v1/territories/:id": { eventType: "TERRITORY.DEACTIVATED", severity: "WARNING" },
  "PUT /api/v1/territories/:id/boundary": { eventType: "TERRITORY.BOUNDARY_SET", severity: "WARNING" },
  "POST /api/v1/territories/:id/approval": { eventType: "TERRITORY.APPROVAL_REQUESTED" },
  "POST /api/v1/territories/:id/approval/accept": { eventType: "TERRITORY.APPROVED" },
  "POST /api/v1/territories/:id/approval/reject": { eventType: "TERRITORY.REJECTED" },

  // --- Field suggestions (Não Conformidades) ---
  "POST /api/v1/facilities/:id/field-suggestions": { eventType: "FIELD_SUGGESTION.CREATED" },
  "POST /api/v1/field-suggestions/:id/approve": { eventType: "FIELD_SUGGESTION.APPROVED" },
  "POST /api/v1/field-suggestions/:id/reject": { eventType: "FIELD_SUGGESTION.REJECTED" },

  // --- Catalog ---
  "POST /api/v1/catalog/products": { eventType: "CATALOG.PRODUCT_CREATED" },
  "PUT /api/v1/catalog/products/:id": { eventType: "CATALOG.PRODUCT_UPDATED" },
  "PATCH /api/v1/catalog/products/:id": { eventType: "CATALOG.PRODUCT_UPDATED" },
  "DELETE /api/v1/catalog/products/:id": { eventType: "CATALOG.PRODUCT_DEACTIVATED", severity: "WARNING" },

  // --- Interactions / calendar ---
  "POST /api/v1/interactions/:id/start": { eventType: "INTERACTION.STARTED" },
  "POST /api/v1/interactions/:id/complete": { eventType: "INTERACTION.COMPLETED" },
  "PATCH /api/v1/calendar/:id/occurrences/:id": {
    eventType: "CALENDAR.OCCURRENCE_RESCHEDULED",
  },
  "DELETE /api/v1/calendar/:id/occurrences/:id": {
    eventType: "CALENDAR.OCCURRENCE_CANCELLED",
    severity: "WARNING",
  },
};

/** Numeric CRM ids and legacy cuid-shaped segments → :id */
const PATH_PARAM_PATTERN = /\/(?:\d+|[0-9a-z]{20,})(?=\/|$)/gi;

/**
 * Normalizes a concrete request path to its route template by replacing
 * numeric / legacy cuid path segments (and calendar occurrence keys) with :id.
 */
function normalizePath(path: string): string {
  return path
    .replace(PATH_PARAM_PATTERN, "/:id")
    .replace(/\/occurrences\/[^/]+/gi, "/occurrences/:id");
}

export function resolveAuditEvent(
  method: string,
  path: string
): EventEntry | null {
  const normalized = normalizePath(path);
  const key = `${method.toUpperCase()} ${normalized}` as RouteKey;
  return routeMap[key] ?? null;
}
