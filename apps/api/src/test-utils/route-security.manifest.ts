/**
 * Security classification for every *.route.ts file under apps/api/src.
 * CI fails when a new route file is added without an explicit entry (E.2).
 */
export type RouteSecurityLevel = "public" | "auth" | "auth+permission";

export const ROUTE_SECURITY_MANIFEST: Record<string, RouteSecurityLevel> = {
  "infrastructure/health/health.route.ts": "public",

  "modules/access/infrastructure/routes/accept-invite.route.ts": "public",
  "modules/access/infrastructure/routes/login.route.ts": "public",
  "modules/access/infrastructure/routes/refresh-session.route.ts": "public",
  "modules/access/infrastructure/routes/request-password-reset.route.ts": "public",
  "modules/access/infrastructure/routes/reset-password.route.ts": "public",
  "modules/access/infrastructure/routes/verify-2fa-login.route.ts": "public",

  "modules/access/infrastructure/routes/capabilities.route.ts": "auth",
  "modules/access/infrastructure/routes/change-password.route.ts": "auth",
  "modules/access/infrastructure/routes/logout.route.ts": "auth",
  "modules/access/infrastructure/routes/profile.route.ts": "auth",
  "modules/access/infrastructure/routes/sessions.route.ts": "auth",
  "modules/access/infrastructure/routes/two-factor.route.ts": "auth",
  "modules/access/infrastructure/routes/verification.route.ts": "auth",

  "modules/access/infrastructure/routes/invite-user.route.ts": "auth+permission",
  "modules/access/infrastructure/routes/list-invitations.route.ts": "auth+permission",
  "modules/access/infrastructure/routes/list-users.route.ts": "auth+permission",
  "modules/access/infrastructure/routes/resend-invite.route.ts": "auth+permission",
  "modules/access/infrastructure/routes/revoke-invite.route.ts": "auth+permission",
  "modules/access/infrastructure/routes/roles.route.ts": "auth+permission",
  "modules/access/infrastructure/routes/user-assignments.route.ts": "auth+permission",
  "modules/access/infrastructure/routes/user-management.route.ts": "auth+permission",
  "modules/access/infrastructure/routes/user-permissions.route.ts": "auth+permission",

  "modules/catalog/infrastructure/routes/catalog.route.ts": "auth+permission",
  "modules/facility/infrastructure/routes/facilities.route.ts": "auth+permission",
  "modules/maps/infrastructure/routes/maps.route.ts": "auth+permission",
  "modules/professional/infrastructure/routes/professionals.route.ts": "auth+permission",
  "modules/registry-ingestion/infrastructure/routes/registry-ingestion.route.ts":
    "auth+permission",
  "modules/territory/infrastructure/routes/territories.route.ts": "auth+permission",
};
