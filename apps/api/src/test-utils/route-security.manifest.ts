/**
 * Security classification for every *.route.ts file under apps/api/src.
 * CI fails when a new route file is added without an explicit entry (E.2).
 */
export type RouteSecurityLevel = "public" | "auth" | "auth+permission";

export const ROUTE_SECURITY_MANIFEST: Record<string, RouteSecurityLevel> = {
  "infrastructure/health/health.route.ts": "public",

  "modules/access/infrastructure/routes/accept-invite.route.ts": "public",
  "modules/access/infrastructure/routes/request-password-reset.route.ts": "public",
  "modules/access/infrastructure/routes/verify-password-reset.route.ts": "public",
  "modules/access/infrastructure/routes/reset-password.route.ts": "public",

  "modules/access/infrastructure/routes/capabilities.route.ts": "auth",
  "modules/access/infrastructure/routes/change-password.route.ts": "auth",
  "modules/access/infrastructure/routes/verification.route.ts": "auth",

  "modules/access/infrastructure/routes/invitation-detail.route.ts": "auth+permission",
  "modules/access/infrastructure/routes/invite-user.route.ts": "auth+permission",
  "modules/access/infrastructure/routes/list-invitations.route.ts": "auth+permission",
  "modules/access/infrastructure/routes/list-users.route.ts": "auth+permission",
  "modules/access/infrastructure/routes/resend-invite.route.ts": "auth+permission",
  "modules/access/infrastructure/routes/revoke-invite.route.ts": "auth+permission",
  "modules/access/infrastructure/routes/roles.route.ts": "auth+permission",
  "modules/access/infrastructure/routes/user.route.ts": "auth",
  "modules/access/infrastructure/routes/verticals.route.ts": "auth+permission",
  "modules/access/infrastructure/routes/user-assignments.route.ts": "auth+permission",
  "modules/access/infrastructure/routes/user-management.route.ts": "auth+permission",
  "modules/access/infrastructure/routes/user-permissions.route.ts": "auth+permission",

  "modules/calendar/infrastructure/routes/calendar.route.ts": "auth+permission",

  "modules/sessions/infrastructure/routes/sessions.route.ts": "auth",
  "modules/user/avatar.route.ts": "auth",

  "modules/catalog/infrastructure/routes/catalog.route.ts": "auth+permission",
  "modules/catalog/infrastructure/routes/competitor-products.route.ts": "auth+permission",
  "modules/catalog/infrastructure/routes/product-comparisons.route.ts": "auth+permission",
  "modules/dashboard/infrastructure/routes/dashboard.route.ts": "auth+permission",
  "modules/facility/infrastructure/routes/cadastro-submissions.route.ts": "auth+permission",
  "modules/facility/infrastructure/routes/facilities.route.ts": "auth+permission",
  "modules/facility/infrastructure/routes/map-facilities.route.ts": "auth+permission",
  "modules/facility/infrastructure/routes/person-projections.route.ts": "auth+permission",
  "modules/field-suggestions/infrastructure/routes/field-suggestions.route.ts": "auth+permission",
  "modules/interactions/infrastructure/routes/interactions.route.ts": "auth+permission",
  "modules/maps/infrastructure/routes/maps.route.ts": "auth+permission",
  "modules/orders/infrastructure/routes/orders.route.ts": "auth+permission",
  "modules/potential/infrastructure/routes/potential.route.ts": "auth+permission",
  "modules/search-sync/infrastructure/routes/search-sync.route.ts": "auth+permission",
  "modules/territory/infrastructure/routes/territories.route.ts": "auth+permission",
  "modules/visits/infrastructure/routes/visits.route.ts": "auth+permission",
};
