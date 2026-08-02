# Feature: Access, Auth, and User Management

## Current State

The access/auth area is mature relative to the rest of the platform. It includes authentication, refresh-token sessions, invitation-based registration, password reset, verification, 2FA, RBAC, instance-level grants, user assignments, audit logging, rate limiting, and security hardening.

Admin user management (list/detail/lifecycle, multi-vertical assignments, invites, grants) is exposed under `/api/v1/access` and consumed by the Flutter Usuários screens via HTTP repositories.

Business verticals (Ortopedia first) gate commercial facility visibility via `facility_vertical_profiles`. See [business-verticals.md](./business-verticals.md).

## Existing User Roles

- `ADMIN`
- `MANAGER`
- `REP`
- `OPS`

## Admin user-management routes (additive)

| Method | Path | Notes |
|---|---|---|
| `GET` | `/access/users` | Paginated list; query supports `status`, `role`, `search`, `verticalId`, `sortBy` (`name`\|`role`\|`status`\|`createdAt`), `sortDir` (`asc`\|`desc`). DTO includes `birthDate`, `lastLoginAt`, `suspendedAt`, `deactivatedAt`, `twoFactorEnabled` |
| `GET` | `/access/users/:id` | Admin single-user lookup |
| `PATCH` | `/access/users/:id` | Admin identity update (name, email, phone, username, birthDate) |
| `GET` | `/access/users/:id/assignments` | Invite-shaped `verticalAssignments[]` with territory boundaries |
| `PUT` | `/access/users/:id/assignments` | Replace per-vertical manager + territories |
| `GET` | `/access/business-verticals` | Active business verticals for selectors |
| `POST` / `DELETE` | `/access/users/:id/verticals` | Assign / revoke a vertical |
| `GET` | `/access/managers/:managerId/assignable-territories?verticalId=` | REP patch picker under a manager |
| `GET` | `/access/invitations` | Enriched with invitee names + staged vertical assignments |
| `GET` | `/access/invitations/:id` | Invitation detail |
| `PATCH` | `/access/invites/:id` | Edit pending invitation |
| `GET` | `/access/users/:id/capabilities` | Grants include `grantedAt` |

Self-service profile remains `PATCH /user` (name/avatar only).

Invite delivery uses Resend (`RESEND_FROM_EMAIL`). Codes are short 8-char strings (hashed at rest). The email accept link is omitted when `FRONTEND_URL` is localhost/http (spam signal on Gmail). DNS: keep Resend `send` SPF/MX + DKIM; apex Cloudflare Email Routing MX is fine; add `_dmarc` for better inbox placement.

Registration identity: inviter sets `birthDate` + name on the invite; invitee must confirm birth date exactly and name via soft fuzzy match (≥50% of name tokens, case/accent-insensitive). Password confirmation is client-side only.

## Clinic visibility (ScopeContext)

| Role | Scope |
|---|---|
| `ADMIN` | Global (`isGlobal`); `assignedVerticalIds` = all active verticals. Optional request `verticalId` filter narrows lists. |
| `OPS` / `MANAGER` / `REP` | **Not** global. Verticals from `user_vertical_assignments`. Unprofiled facilities are ADMIN-only. Facility visibility is role-specific (below) ∩ active `facility_vertical_profiles` in resolved verticals. |
| `REP` | Patch UTA kept for org/map; clinic `facilityIds` = active `facility_consultant_assignments` only (filtered by resolved verticals). Geo patch does **not** grant clinic list access. |
| `MANAGER` | Clinic access via Spec 0006: `manager_zone_id IN oversightZoneIds` ∪ own consultant assigns (scope caches zone ids; membership is manager zone, not rep patch). |
| `OPS` | Clinic `facilityIds` = all facilities with active profile in assigned verticals (no zone cover). |
| `MANAGER` | Own territory oversight ∪ own consultant assignments. Does **not** include peer managers’ zones. Analytics facility set remains report-territory based (no consultant union). |

### Manager ↔ REP (Spec 0006, 2026-08-02)

- **Not** `users.manager_id` for runtime team/scope/clinic gerente.
- Derive: zone UTA → child patches → patch UTAs (= team). Clinic gerente = UTA on `manager_zone_id`.
- Multi-manager REPs allowed (patches under different managers’ zones).
- Edit roles: ADMIN CRUD zones + patches; MANAGER create/edit patches under own zones only.
- Downstream TODOs: invite overhaul (drop invite/UVA `manager_id`), user-profile multi-manager UI, stop-write + drop `users.manager_id` / `user_vertical_assignments.manager_id`, dual-read compat while clients migrate.

Optional query/body `verticalId` is validated against the caller’s allowed set (`ForbiddenError` if outside). Omit → union of assigned verticals (ADMIN without filter: all facilities including unprofiled).

Scope cache is invalidated when consultant assignments change (assignee + previous assignee).

API lists/details that take `getScope()` filter or `assertResourceInScope` on `facilityIds`. Mobile nav/actions mirror CASL via `role_capabilities.dart`; empty/403 from API remains authoritative.

Orders: REP list/detail restricted to `sellerId = actor` within facility scope.

## Cadastro review vs upload

| Action | CASL | Roles |
|---|---|---|
| Upload / submit facility docs | `update FACILITY` | ADMIN, MANAGER, REP |
| List / approve / reject Cadastro queue | `read` / `update CADASTRO_SUBMISSION` | ADMIN, MANAGER, OPS |

REP must not see the Cadastros ops queue. OPS reviews without needing `update FACILITY`.

Cadastro drafts persist `vertical_id`. Inference: one facility profile → use it; else one user vertical matching a facility profile → use it; else require `verticalId` in the ensure-draft body. Completion writes `commercial_status` on `facility_vertical_profiles` for that vertical.

## Known Follow-Ups

- Align grant `conditions` semantics between API, CASL helpers, and UI.
- Finish Spec 0006 clinic-ownership design if ownership should diverge from consultant assignments.
- Expand audit events for 2FA failure reasons and permission changes.
- Add SSO/OIDC support for Google, Microsoft Entra ID, and Okta readiness.
- Add 2FA recovery codes and admin reset workflow.
- WhatsApp invite delivery requires Twilio env (email path uses Resend).
- Territory × vertical ownership — design accepted; implementation on `feature/territory-vertical-ownership-20260726` / PR #120 (see [vertical-ownership-design.md](../../specs/0003-territory-management/vertical-ownership-design.md)).
