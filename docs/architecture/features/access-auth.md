# Feature: Access, Auth, and User Management

## Current State

The access/auth area is mature relative to the rest of the platform. It includes authentication, refresh-token sessions, invitation-based registration, password reset, verification, 2FA, RBAC, instance-level grants, user assignments, audit logging, rate limiting, and security hardening.

Admin user management (list/detail/lifecycle, multi-sector assignments, invites, grants) is exposed under `/api/v1/access` and consumed by the Flutter Usuários screens via HTTP repositories.

## Existing User Roles

- `ADMIN`
- `MANAGER`
- `REP`
- `OPS`

## Admin user-management routes (additive)

| Method | Path | Notes |
|---|---|---|
| `GET` | `/access/users` | Paginated list; query supports `status`, `role`, `search`, `sectorId`, `sortBy` (`name`\|`role`\|`status`\|`createdAt`), `sortDir` (`asc`\|`desc`). DTO includes `birthDate`, `lastLoginAt`, `suspendedAt`, `deactivatedAt`, `twoFactorEnabled` |
| `GET` | `/access/users/:id` | Admin single-user lookup |
| `PATCH` | `/access/users/:id` | Admin identity update (name, email, phone, username, birthDate) |
| `GET` | `/access/users/:id/assignments` | Invite-shaped `sectorAssignments[]` with territory boundaries |
| `PUT` | `/access/users/:id/assignments` | Replace per-sector manager + territories |
| `GET` | `/access/managers/:managerId/assignable-territories?sectorId=` | REP patch picker under a manager |
| `GET` | `/access/invitations` | Enriched with invitee names + staged sector assignments |
| `GET` | `/access/invitations/:id` | Invitation detail |
| `PATCH` | `/access/invites/:id` | Edit pending invitation |
| `GET` | `/access/users/:id/capabilities` | Grants include `grantedAt` |

Self-service profile remains `PATCH /user` (name/avatar only).

Invite delivery uses Resend (`RESEND_FROM_EMAIL`). Codes are short 8-char strings (hashed at rest). The email accept link is omitted when `FRONTEND_URL` is localhost/http (spam signal on Gmail). DNS: keep Resend `send` SPF/MX + DKIM; apex Cloudflare Email Routing MX is fine; add `_dmarc` for better inbox placement.

Registration identity: inviter sets `birthDate` + name on the invite; invitee must confirm birth date exactly and name via soft fuzzy match (≥50% of name tokens, case/accent-insensitive). Password confirmation is client-side only.

## Known Follow-Ups

- Finish authorization scope enforcement before exposing sensitive clinical/healthcare relationship data.
- Align grant `conditions` semantics between API, CASL helpers, and UI.
- Expand audit events for 2FA failure reasons and permission changes.
- Add SSO/OIDC support for Google, Microsoft Entra ID, and Okta readiness.
- Add 2FA recovery codes and admin reset workflow.
- WhatsApp invite delivery requires Twilio env (email path uses Resend).
