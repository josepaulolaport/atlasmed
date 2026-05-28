# AtlasMed — Access / Auth Remaining Work

> Last updated: 2026-05-26  
> Scope: `apps/api/src/modules/access`, `packages/access`, related infra.  
> **Out of scope here:** clinic module wiring, SSO/OIDC providers, external SIEM endpoints.

Reference plan: [`apps/api/docs/ACCESS_AUTH_HARDENING_PLAN.md`](apps/api/docs/ACCESS_AUTH_HARDENING_PLAN.md)

---

## Recently completed (Sprint 1–2 + Phase C/E partial)

- [x] **A.1** Change-password revokes other sessions by default (`revokeOtherSessions ?? true`)
- [x] **A.2** Refresh-token reuse detection via `previousRefreshTokenHash` + grace window
- [x] **A.3** Atomic 2FA pending consume (`GETDEL`), per-token attempt limit, rate limit on verify route
- [x] **A.4** `tokenVersion` bump on 2FA enable/disable
- [x] **A.5** `TRUST_PROXY` + unified `getClientIp()`; production requires `SESSION_SECURITY_MODE=strict`
- [x] **AC.2** Redis key prefix on login rate limiter
- [x] **AC.3** Dummy hash verify on email-not-verified login path
- [x] **B.1** Route-level permission checks via `canAccessRoute` / `canAccessResource`
- [x] **B.4** Grant validation + unique permission index migration
- [x] **C.1** Removed dead User lockout columns (`failedLoginAttempts`, `lockedUntil`, `lastFailedLoginAt`)
- [x] **C.2** Removed password expiry (`passwordExpiresAt`, `PASSWORD_MAX_AGE_DAYS`, login enforcement)
- [x] **C.3** Removed `UserRepository.delete()` from production interface
- [x] **C.4** Expired permission cleanup job in `cleanup.jobs.ts`
- [x] **D.1** (partial) `logSessionCreate`, `log2FARequired` wired in login flows
- [x] **D.2** (partial) Metrics wired: password reset request/complete, invite create/resend
- [x] **E.1** (partial) HTTP integration tests: login → profile → refresh → logout
- [x] **E.2** Route auth registry test (`routes-auth-registry.test.ts`)
- [x] **555** access module tests passing

---

## P0 — Before exposing scoped clinical data

### Authorization scope enforcement (deferred clinic wiring)

- [ ] **B.2** Call `assertResourceInScope()` in every use-case that reads/updates/deletes by resource ID
- [ ] **B.3** Replace `StubTerritoryScopePort` with real clinic-backed port *(blocked on clinic schema — ignore for now per product direction)*
- [ ] **B.4 follow-up** Decide fate of `conditions` on grants: implement in CASL or remove from API until ready
- [ ] **B.4 follow-up** Align `GetCapabilitiesUseCase` / web UI with scoped grant semantics

---

## P1 — Security & compliance hardening

### Audit coverage (D.1)

- [ ] Distinct audit event for failed 2FA verify (`invalid_totp`, `pending_expired`, `attempts_exceeded`)
- [ ] Align reset complete event: use `PASSWORD_RESET_COMPLETE` consistently (vs `PASSWORD_CHANGE`)
- [ ] Audit on grant/revoke permission, role change, session revoke, 2FA enable/disable (verify all emit)
- [ ] Template `logDataAccess` / `logDataExport` hooks at repository boundaries *(for when PHI modules ship)*

### Metrics (D.2 — remaining)

- [ ] `recordRefresh` on successful refresh
- [ ] `record2FA` counters (setup, verify success/fail, disable)
- [ ] `recordGrant` / `recordRevoke` on permission changes
- [ ] Login success/failure counters (if not already via existing metrics service)
- [ ] Extend `IMetrics` interface + adapter + test mocks for new methods

### SIEM export (D.3)

- [ ] Idempotency key per export batch
- [ ] Include `userAgent`, `outcome`, `severity` in SIEM payload
- [ ] `exportedAt` column or export ledger before INFO retention delete
- [ ] Dead-letter / alert on repeated export failures

### Data model (C — remaining)

- [ ] Partial unique indexes: `email WHERE deleted_at IS NULL`, `username WHERE deleted_at IS NULL`
- [ ] Ensure deactivate/suspend consistently sets `deletedAt` when soft-delete policy applies
- [ ] Document single source of truth for account lockout (Redis-only, confirmed)

---

## P2 — Test & ops maturity

### HTTP integration tests (E.1 — expand)

- [ ] Login with 2FA → verify → session
- [ ] Change password → old refresh token fails
- [ ] Invite → accept → login
- [ ] Password reset request → reset → login
- [ ] Permission denied (403) on protected route
- [ ] Refresh reuse triggers revoke-all (theft path)

### Service / repository test gaps (E.3)

- [ ] `TwoFactorService` unit tests
- [ ] `Pending2FALoginService` unit tests (+ race test for parallel verify)
- [ ] `ScopeService` / `ScopeResolverService` unit tests
- [ ] `AccessGrantService` unit tests
- [ ] `PrismaScopeRepository` integration tests
- [ ] `PrismaAccessGrantRepository` integration tests

### Edge / race tests (E.4)

- [ ] Change-password concurrent requests
- [ ] Refresh reuse after superseded Redis TTL expired (DB fallback path)
- [ ] Invite accept — username collision returns domain error, not 500
- [ ] Verify email-not-verified login always runs dummy hash (timing test)

---

## P3 — Cross-cutting cleanup (AC items)

- [ ] **AC.1** Verification routes → use-cases (`RequestEmailVerification`, `VerifyEmail`, phone equivalents)
- [ ] **AC.4** Product decision: can USER role list peers in same territory?
- [ ] **AC.5** Product decision: manager with reports but no territories — operationally active?
- [ ] **AC.6** Remove dead `SessionService.enforceSessionCap()` or wire into create path
- [ ] **AC.7** Replace `any` in repository interfaces with domain DTOs (incremental)
- [ ] Auth plugin: request-scoped memoization for `getUser` / grant resolution (perf under load)

---

## P4 — Long-term product (post-MVP)

- [ ] **F.1** SSO / OIDC adapter behind same `SessionService.create`
- [ ] **F.2** 2FA recovery codes + admin reset workflow with audit
- [ ] **F.3** JWT asymmetric keys (RS256/ES256) + rotation runbook

---

## Web client (auth UX)

- [ ] Complete 2FA login page wiring (`apps/web/app/(auth)/login/2fa/page.tsx`) — verify error states, redirect
- [ ] Change-password UI sends `revokeOtherSessions: true` explicitly
- [ ] Capabilities endpoint consumption for conditional UI rendering
- [ ] Session management UI (list/revoke sessions)

---

## Production checklist

```env
TRUST_PROXY=true                    # only behind trusted reverse proxy
SESSION_SECURITY_MODE=strict
TOKEN_HASH_PEPPER=...
TWO_FACTOR_ENCRYPTION_KEY=...       # if 2FA enabled
REFRESH_ROTATION_GRACE_MS=10000     # optional; default 10s
REDIS_KEY_PREFIX=atlasmed:          # confirm consistent across services
```

- [ ] Ingress strips client-supplied `X-Forwarded-For` before app sees request
- [ ] Run pending migrations on staging/production (`20260526210000_*`, `20260526220000_*`)
- [ ] Confirm cleanup jobs scheduled (sessions, permissions, audit retention, SIEM export)

---

## How to verify locally

```bash
cd packages/database && bunx prisma migrate deploy && bunx prisma generate
cd apps/api && bun run db:migrate:test
cd apps/api && NODE_ENV=test bun test src/modules/access
cd packages/access && bun test
```
