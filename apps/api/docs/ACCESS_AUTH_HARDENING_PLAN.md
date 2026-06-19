# Access / Auth Module — Hardening & Remediation Plan

> **Purpose:** Track and implement all findings from the deep architectural review of `apps/api/src/modules/access` and `packages/access`. Work through phases in order; later phases may depend on earlier ones.
>
> **Last updated:** 2026-05-27

---

## How to use this document

- Each item has a **checkbox**, **priority**, **owner area**, **files**, and **acceptance criteria**.
- Mark items `[x]` when merged and verified.
- **Phase A–B are blockers** before clinic/visit modules expose scoped data.
- Do **not** introduce NestJS, decorators, CQRS, or microservices — stay with explicit composition and use-cases.

---

## Status overview

| Phase | Focus | Items | Status |
|-------|--------|-------|--------|
| A | Security closes | 6 | Partial (A.1, A.2, A.5, A.6 done; A.3, A.4 deferred) |
| B | Authorization correctness | 4 | Partial (B.1 done; B.2, B.3 deferred; B.4 partial) |
| C | Data model hygiene | 4 | Mostly done |
| D | Observability & compliance | 3 | Partial |
| E | Test & ops maturity | 3 | Partial |
| F | Long-term product | 3 | Deferred |
| — | Early-stage hardening sprint | 7 | Done (error hygiene, headers, fail-closed, HTTP tests, metrics, ops docs, web reuse UX) |
| — | Preserve (no change) | 14 patterns | Reference only |

### Deferred until 2FA / territory product work

- **A.3** Atomic pending 2FA consume hardening (partially implemented; race test deferred)
- **A.4** 2FA enable/disable session revocation
- **B.2** Universal `assertResourceInScope` on all modules
- **B.3** Territory scope enforcement expansion (port wired; full rollout deferred)
- **B.4 follow-up** Grant `conditions` in CASL

---

## Phase A — Security closes (blockers)

### A.1 Change-password must invalidate refresh sessions by default

**Priority:** Critical  
**Issue:** `tokenVersion` bumps invalidate access JWTs, but refresh cookies remain valid unless `revokeOtherSessions: true`. Attacker can refresh after victim changes password.

**Files:**
- `apps/api/src/modules/access/application/use-cases/change-password.use-case.ts`
- `apps/api/src/modules/access/infrastructure/routes/change-password.route.ts`
- `packages/access/src/schemas/change-password.schema.ts`
- `apps/api/src/modules/access/application/use-cases/change-password.use-case.test.ts`
- `apps/web/lib/api/auth.ts` (if client passes `revokeOtherSessions`)

**Tasks:**
- [ ] Default `revokeOtherSessions` to `true` in use-case (`?? true` instead of `?? false`).
- [ ] Update Zod schema default or document API contract; align web client to send `true` explicitly.
- [ ] Always invalidate session cache for user on password change (even when keeping current session).
- [ ] Add/update unit test: password change without explicit flag still revokes other sessions.
- [ ] Add unit test: current session preserved when `keepSessionId` provided.

**Acceptance criteria:**
- After change-password, only the current session (if any) can refresh; all other refresh tokens fail.
- Behavior matches password-reset session revocation semantics.

---

### A.2 Refresh-token reuse — close Path A blind spot

**Priority:** Critical  
**Issue:** When superseded hash is missing from Redis (TTL expired / cache cold), reused refresh token returns `TokenInvalidError` only — no revoke-all, no theft audit. Path B (superseded cache hit) is correct.

**Files:**
- `apps/api/src/modules/access/infrastructure/repositories/prisma/prisma-session.repository.ts`
- `apps/api/src/modules/access/application/use-cases/refresh-session.use-case.ts`
- `apps/api/src/modules/access/application/interfaces/session.repository.interface.ts`
- `packages/database/prisma/schema.prisma` (+ migration)
- `apps/api/src/modules/access/application/use-cases/refresh-session.use-case.test.ts`
- `apps/api/src/modules/access/application/use-cases/refresh-session.race-condition.test.ts`

**Tasks:**
- [ ] Persist `previousRefreshTokenHash` (or rotation generation counter) on session row at rotate time.
- [ ] On `alreadyRotated`: if presented hash matches **previous** hash → treat as theft (`revokeAllByUserId`, audit, `RefreshTokenReuseDetectedError`).
- [ ] If hash mismatch is concurrent refresh (winner already rotated, loser has old hash within grace window) → keep benign `TokenInvalidError` OR document single-flight client retry.
- [ ] Extend superseded Redis TTL to match max session lifetime or rely on DB fallback.
- [ ] Add test: reuse after superseded Redis key expired still triggers revoke-all via DB.

**Acceptance criteria:**
- Stolen old refresh token always triggers global session revocation + audit, regardless of Redis state.
- Concurrent legitimate double-refresh still yields 1 success + N invalid (existing race test passes).

---

### A.3 Atomic pending 2FA consume + per-token rate limit

**Priority:** Critical  
**Issue:** `GET` then `DEL` allows duplicate `/login/2fa` submissions → two sessions. Invalid TOTP does not burn token; only IP rate limit applies.

**Files:**
- `apps/api/src/modules/access/application/services/pending-2fa-login.service.ts`
- `apps/api/src/modules/access/application/use-cases/verify-2fa-login.use-case.ts`
- `apps/api/src/modules/access/infrastructure/routes/verify-2fa-login.route.ts`
- `apps/api/src/modules/access/infrastructure/middleware/rate-limit.middleware.ts`
- New: `pending-2fa-login.service.test.ts`, race test for 2FA verify

**Tasks:**
- [ ] Replace consume with Redis `GETDEL` or Lua script (atomic read-delete).
- [ ] Add per-`pendingToken` attempt counter (e.g. max 5 TOTP attempts, then invalidate pending).
- [ ] Add rate limit key: `pendingToken` prefix + IP.
- [ ] Audit failed 2FA verify attempts (reason: `invalid_totp`, `pending_expired`).
- [ ] Add race-condition test: parallel verify with same pending token → 1 session.

**Acceptance criteria:**
- Duplicate concurrent 2FA verify creates at most one session.
- Brute-force on leaked pending token is bounded by per-token attempts + TTL.

---

### A.4 Bump `tokenVersion` on 2FA enable and disable

**Priority:** High (listed in critical path for security)  
**Issue:** Disabling 2FA leaves all sessions valid; enabling also skips invalidation. Attacker with session can disable 2FA without re-auth beyond password+TOTP on that request only.

**Files:**
- `apps/api/src/modules/access/application/use-cases/disable-2fa.use-case.ts`
- `apps/api/src/modules/access/application/use-cases/confirm-2fa-setup.use-case.ts`
- `apps/api/src/modules/access/infrastructure/repositories/prisma/prisma-user.repository.ts`
- `disable-2fa.use-case.test.ts`, `confirm-2fa-setup.use-case.test.ts`

**Tasks:**
- [ ] On disable: increment `tokenVersion`, invalidate auth cache, optionally revoke other sessions (product decision: recommend revoke all except current).
- [ ] On confirm setup: increment `tokenVersion` (forces re-login on other devices).
- [ ] Update tests to assert `tokenVersion` increment + cache invalidation.

**Acceptance criteria:**
- After 2FA state change, existing access JWTs on other devices fail auth plugin checks.

---

### A.5 Trusted proxy + unified client IP

**Priority:** Critical  
**Issue:** `getClientIp` trusts first `X-Forwarded-For` hop; some routes use raw header. Spoofing affects rate limits, audit, session security.

**Files:**
- `apps/api/src/shared/utils/client-ip.ts`
- `apps/api/src/app/config/environment.ts`
- `apps/api/.env.example`
- All access routes using IP (grep `x-forwarded-for`, `getClientIp`)
- `apps/api/src/infrastructure/middleware/global-rate-limit.middleware.ts`

**Tasks:**
- [ ] Add `TRUST_PROXY` / `TRUSTED_PROXY_CIDRS` env config.
- [ ] Only read `X-Forwarded-For` / `X-Real-IP` when request comes from trusted proxy; else use connection IP or single source.
- [ ] Replace raw `x-forwarded-for` usage in password-reset routes with `getClientIp`.
- [ ] Document ingress requirement (strip client-supplied forwarded headers at edge).
- [ ] Add unit tests for spoofed vs trusted proxy paths.

**Acceptance criteria:**
- Direct client cannot spoof IP for rate limiting when `TRUST_PROXY=false`.
- Production config validates proxy trust when behind load balancer.

---

### A.6 Production env validation for security flags

**Priority:** High  
**Issue:** `SESSION_SECURITY_MODE=audit_only` allows refresh despite IP/UA drift; missing pepper/encryption keys weaken token and 2FA storage.

**Files:**
- `apps/api/src/app/config/environment.ts`
- `apps/api/.env.example`

**Tasks:**
- [ ] When `NODE_ENV=production`: require `SESSION_SECURITY_MODE=strict` (or fail startup).
- [ ] When `TWO_FACTOR_ENABLED=true`: require `TWO_FACTOR_ENCRYPTION_KEY` (min length).
- [ ] Recommend require `TOKEN_HASH_PEPPER` in production (warn or fail).
- [ ] Document in `.env.example`.

**Acceptance criteria:**
- API refuses to start in production with insecure session security mode.

---

## Phase B — Authorization correctness (before clinic module)

### B.1 Fix CASL middleware for resource-scoped grants

**Priority:** Critical  
**Issue:** `requirePermission(action, subject)` calls `ability.can(action, subject)` without `{ id }`. Scoped grant `update CLINIC:clinic-1` makes `can("update", "CLINIC")` true globally at route layer.

**Files:**
- `apps/api/src/modules/access/infrastructure/middleware/permission.middleware.ts`
- `packages/access/src/permissions/grant.permissions.ts`
- `packages/access/src/permissions/grant.permissions.test.ts`
- Routes that need instance-level checks (audit all `requirePermission` usages)

**Tasks:**
- [ ] Option A (recommended): Add `requirePermission(action, subject, { resourceIdFrom: 'params.id' })` variant for instance routes.
- [ ] Option B: Split routes — collection endpoints use type-level check; instance endpoints pass `subject(type, { id })`.
- [ ] Update grant tests: `can("update", "CLINIC")` without id must be **false** when grant is scoped.
- [ ] Audit every protected route; document which use-case enforces scope.

**Acceptance criteria:**
- USER with grant on `clinic-1` cannot pass middleware for `clinic-2` mutation routes.
- Role-only permissions unchanged.

---

### B.2 Wire `assertResourceInScope` at module boundaries

**Priority:** Critical (before PHI)  
**Issue:** Helper exported from `@atlasmed/access` but **zero callers** in API. Cross-module row guards not enforced.

**Files:**
- `packages/access/src/scope/scope-enforcement.helpers.ts`
- Future: clinic/visit module repositories or use-cases
- `apps/api/src/modules/access/` — add pattern doc in composition header

**Tasks:**
- [ ] Define convention: every read/update/delete by resource ID calls `assertResourceInScope(scope, type, id)` in use-case layer.
- [ ] Add shared helper wrapper in access module if needed: `assertScopedAccess(getScope, type, id)`.
- [ ] Add integration test template other modules can copy.
- [ ] Block clinic module PRs until port + assertion pattern in place.

**Acceptance criteria:**
- Documented mandatory pattern; at least one reference implementation in access module (e.g. user mutations already use `assertCanMutateUser`).

---

### B.3 Implement real `TerritoryScopePort` (when clinic schema exists)

**Priority:** Critical for clinic launch  
**Issue:** `StubTerritoryScopePort` returns `[]` for all `clinicIds`.

**Files:**
- `apps/api/src/modules/access/infrastructure/scope/stub-territory-scope.port.ts`
- New: `prisma-territory-scope.port.ts` (or clinic module adapter)
- `apps/api/src/modules/access/composition.ts`
- `apps/api/src/modules/access/application/services/scope-resolver.service.ts`

**Tasks:**
- [ ] Implement `getClinicIdsForTerritories(territoryIds)` against clinic/territory tables.
- [ ] Wire in composition; remove stub from production path.
- [ ] Integration test: USER with territory assignment gets non-empty `clinicIds`.
- [ ] Remove `console.warn` from stub; use structured logger only in stub until replaced.

**Acceptance criteria:**
- `getScope()` returns accurate `clinicIds` for USER and MANAGER roles.

**Dependency:** Clinic module schema (`Territory`, `Clinic` or equivalent).

---

### B.4 Permission grants — validation and deduplication

**Priority:** High  
**Issue:** Invalid resource/action strings silently no-op; duplicate grant rows possible; `conditions` stored but never applied.

**Files:**
- `packages/database/prisma/schema.prisma` (+ migration)
- `apps/api/src/modules/access/application/use-cases/grant-permission.use-case.ts`
- `packages/access/src/contracts/access-grant.contract.ts`
- `packages/access/src/schemas/` (grant schema)
- `apps/api/src/modules/access/infrastructure/repositories/prisma/prisma-access-grant.repository.ts`

**Tasks:**
- [ ] Validate `resource` and `action` against enums at grant time (reject unknown).
- [ ] Add unique constraint: `(userId, resource, resourceId, action)` where not expired (partial index or app-level upsert).
- [ ] **Decision:** Implement `conditions` in CASL OR remove from API/schema until implemented — do not store unused JSON.
- [ ] Update `GetCapabilitiesUseCase` / UI permissions to include grants consistently.

**Acceptance criteria:**
- Duplicate grants cannot be created.
- Invalid grant payload returns 400, not silent no-op.

---

## Phase C — Data model hygiene

### C.1 Resolve dead User lockout fields

**Priority:** Medium  
**Issue:** `failedLoginAttempts`, `lockedUntil`, `lastFailedLoginAt` exist in DB but lockout is Redis-only. Fields reset on login/password change but never incremented.

**Files:**
- `packages/database/prisma/schema.prisma`
- `apps/api/src/modules/access/application/services/rate-limiter.service.ts`
- `apps/api/src/modules/access/infrastructure/repositories/prisma/prisma-user.repository.ts`
- `apps/api/src/modules/access/application/use-cases/login.use-case.ts`

**Tasks:**
- [ ] **Decision A:** Remove columns via migration (simplest).
- [ ] **Decision B:** Sync Redis lockout to DB for audit/durability (increment on fail, clear on success).
- [ ] Document single source of truth in composition or constants.

**Acceptance criteria:**
- No misleading unused columns in schema OR fields actively maintained.

---

### C.2 Password expiry — removed

**Status:** Removed (2026-05-27). Column `passwordExpiresAt`, env `PASSWORD_MAX_AGE_DAYS`, and login enforcement were dropped. Password history and `passwordChangedAt` remain for reuse prevention and audit.

---

### C.3 Soft-delete only — remove hard delete path

**Priority:** Medium  
**Issue:** Policy says users never deleted; `UserRepository.delete()` performs hard delete.

**Files:**
- `apps/api/src/modules/access/application/interfaces/user.repository.interface.ts`
- `apps/api/src/modules/access/infrastructure/repositories/prisma/prisma-user.repository.ts`
- `packages/database/prisma/schema.prisma` (+ migration for partial uniques)

**Tasks:**
- [ ] Remove `delete()` from repository interface or restrict to test-only.
- [ ] Ensure deactivate/suspend flows set `deletedAt` if soft-delete used.
- [ ] Add partial unique indexes: `email WHERE deleted_at IS NULL` (Postgres) for reactivation safety.

**Acceptance criteria:**
- No production code path hard-deletes users.

---

### C.4 Schedule expired permission cleanup

**Priority:** Medium  
**Issue:** `AccessGrantService.cleanupExpiredPermissions()` exists but not in `cleanup.jobs.ts`.

**Files:**
- `apps/api/src/infrastructure/jobs/cleanup.jobs.ts`
- `apps/api/src/modules/access/application/services/access-grant.service.ts`

**Tasks:**
- [ ] Add recurring job (e.g. daily) to delete or mark expired permissions.
- [ ] Invalidate affected user grant caches.
- [ ] Test job handler.

**Acceptance criteria:**
- Expired grants removed from DB; cache not serving stale grants beyond TTL.

---

## Phase D — Observability & compliance

### D.1 Complete audit event coverage

**Priority:** High (healthcare)  
**Issue:** `SESSION_CREATE`, `PASSWORD_RESET_COMPLETE`, 2FA challenge step, `DATA_ACCESS`, `DATA_EXPORT` missing or unused.

**Files:**
- `apps/api/src/infrastructure/audit/audit-log.service.ts`
- `apps/api/src/modules/access/application/services/session.service.ts`
- `apps/api/src/modules/access/application/use-cases/login.use-case.ts`
- `apps/api/src/modules/access/application/use-cases/reset-password.use-case.ts`
- Module adapters: `audit-log.adapter.ts`

**Tasks:**
- [ ] Emit `SESSION_CREATE` on successful login / 2FA verify.
- [ ] Emit distinct event on 2FA required (pending token issued).
- [ ] Align reset complete: use `PASSWORD_RESET_COMPLETE` or document mapping to `PASSWORD_CHANGE`.
- [ ] Wire `logDataAccess` at repository boundaries when clinic module reads PHI (template now).
- [ ] Wire `logDataExport` for bulk export endpoints when they exist.

**Acceptance criteria:**
- SIEM can filter session lifecycle and auth funnel without parsing ad-hoc `details` only.

---

### D.2 Wire missing Prometheus metrics

**Priority:** Medium  
**Issue:** Counters defined but not all called (`password_resets_total`, invite create, refresh, 2FA, grants).

**Files:**
- `apps/api/src/infrastructure/monitoring/metrics.service.ts`
- `apps/api/src/modules/access/application/interfaces/metrics.interface.ts`
- `apps/api/src/modules/access/infrastructure/adapters/metrics.adapter.ts`
- Relevant use-cases (login, refresh, invite, grant, reset)

**Tasks:**
- [ ] Extend `IMetrics` with required methods; implement in adapter.
- [ ] Call from: request-password-reset, reset-password, refresh-session, invite-user, grant/revoke permission, 2FA enable/disable.
- [ ] Verify Grafana/dashboard placeholders if any.

**Acceptance criteria:**
- All auth funnels visible in metrics; no dead metric definitions.

---

### D.3 SIEM export hardening

**Priority:** Medium  
**Issue:** No idempotency key; cursor-only cursor; INFO logs may delete before export alignment; payload omits some fields.

**Files:**
- `apps/api/src/infrastructure/audit/siem-export.helper.ts`
- `apps/api/src/infrastructure/jobs/cleanup.jobs.ts`
- `packages/database/prisma/schema.prisma` (optional: `exportedAt` on audit_logs)

**Tasks:**
- [ ] Add idempotency key per batch (event ids hash).
- [ ] Include `userAgent`, `outcome`, `severity` in SIEM payload.
- [ ] Consider `exportedAt` column or export ledger before INFO retention delete.
- [ ] Dead-letter or alert on repeated export failures.

**Acceptance criteria:**
- No silent audit loss between export and retention jobs.

---

## Phase E — Test & ops maturity

### E.1 HTTP integration test suite for auth flows

**Priority:** High  
**Issue:** 33 use-case unit tests + 4 race tests; no e2e HTTP flow tests.

**Files:**
- New: `apps/api/src/modules/access/access-auth.integration.test.ts` (or `test/` folder)
- Reuse: `test-helpers/access-test-app.ts`

**Tasks:**
- [ ] Login → access protected route → refresh → logout.
- [ ] Login with 2FA → verify → session.
- [ ] Change password → old refresh fails.
- [ ] Invite → accept → login.
- [ ] Password reset flow.
- [ ] Permission denied (403) and scope denied paths.

**Acceptance criteria:**
- CI runs integration tests against test DB; covers happy path + 2 failure modes per flow.

---

### E.2 Protected route guard — lint or registry test

**Priority:** Medium  
**Issue:** Each route must manually `.use(auth)`; easy to forget.

**Files:**
- New test: scan route modules or maintain route registry
- `apps/api/src/modules/access/index.ts`

**Tasks:**
- [ ] Test: all routes except allowlist (login, refresh, register, reset, 2fa verify) import/use auth.
- [ ] Allowlist documented in test file.

**Acceptance criteria:**
- New protected route without auth fails CI.

---

### E.3 Service and repository test gaps

**Priority:** Medium  
**Issue:** Missing tests for TwoFactorService, Pending2FALoginService, ScopeService, AccessGrantService, PrismaScopeRepository, PrismaAccessGrantRepository.

**Files:**
- Colocated `*.test.ts` for each service/repo above

**Tasks:**
- [ ] Add unit tests for each untested service (mock Redis/Prisma).
- [ ] Add repository integration tests for scope and access-grant repos.

**Acceptance criteria:**
- No untested security-critical service in access module.

---

### E.4 Additional race and edge tests

**Priority:** Medium  

**Tasks:**
- [ ] Change-password concurrent requests.
- [ ] Refresh reuse after superseded TTL (Phase A.2).
- [ ] Invite accept cross-invite username collision → domain error not 500.
- [ ] Email-not-verified login timing: always run dummy hash verify.

**Acceptance criteria:**
- Documented edge cases have automated coverage.

---

## Phase F — Long-term product (post-MVP)

### F.1 SSO / OIDC

**Priority:** Long-term  
**Tasks:**
- [ ] Add OIDC adapter behind same session creation (`SessionService.create`).
- [ ] Map IdP claims to User + Role; invite-only or JIT provisioning policy.
- [ ] Audit `USER_LOGIN` with `method: oidc`.

---

### F.2 2FA recovery (backup codes / admin reset)

**Priority:** Long-term  
**Tasks:**
- [ ] Backup codes at 2FA setup; hashed storage; one-time use.
- [ ] Admin workflow to disable 2FA with audit + ticket reference.
- [ ] Rate limit admin recovery.

---

### F.3 JWT asymmetric keys + rotation

**Priority:** Long-term  
**Tasks:**
- [ ] RS256/ES256 with `kid` in header.
- [ ] Key rotation without mass logout (multi-key verify window).
- [ ] Document operational runbook.

---

## Architectural fixes (cross-cutting, schedule with phases)

### AC.1 Verification flows → use-cases

**Priority:** Medium  
**Issue:** `verification.route.ts` calls `VerificationService` directly.

**Tasks:**
- [ ] Add use-cases: `RequestEmailVerification`, `VerifyEmail`, (phone equivalents).
- [ ] Route delegates to `accessUseCases.*`; audit in use-case.

---

### AC.2 Login rate limiter Redis key prefix

**Priority:** Medium  
**Issue:** Login attempt keys lack `REDIS_KEY_PREFIX` unlike 2FA keys.

**Files:** `apps/api/src/modules/access/application/services/rate-limiter.service.ts`

**Tasks:**
- [ ] Prefix all keys with `environment.REDIS_KEY_PREFIX`.

---

### AC.3 Email-not-verified path constant-time

**Priority:** Medium  
**Files:** `login.use-case.ts`

**Tasks:**
- [ ] Run `passwordService.verify(password, DUMMY_PASSWORD_HASH)` before failing when email not verified.

---

### AC.4 List users scope — territory visibility

**Priority:** Medium (product decision)  
**Issue:** Non-global list filters only `managedUserIds`; USER role gets empty list.

**Tasks:**
- [ ] Product decision: can USER list peers in same territory?
- [ ] If yes: extend `UserListScopeFilter` and `findAll` query.

---

### AC.5 Manager `isOperationallyActive` rule

**Priority:** Low  
**Issue:** Requires both managed users AND territories.

**Tasks:**
- [ ] Product decision: manager with reports but no territories — active or not?
- [ ] Adjust `ScopeResolver` and tests.

---

### AC.6 Remove dead code

**Priority:** Low  
**Tasks:**
- [ ] Remove unused `SessionService.enforceSessionCap()` or call from create path.
- [ ] Remove redundant `@@index([email])` if unique covers (optional cleanup migration).

---

### AC.7 Repository interface typing

**Priority:** Low  
**Tasks:**
- [ ] Replace `any` in repository interfaces with domain DTOs (no Prisma types in interfaces).
- [ ] Incremental: start with `UserRepository`, `SessionRepository`.

---

### AC.8 Auth plugin request-scoped snapshot

**Priority:** Low  
**Tasks:**
- [ ] Memoize `getScope()` / `getAccessGrants()` / `getUser()` per request in plugin derive to avoid duplicate Redis/DB hits.

---

## Database migration checklist

| Migration | Phase | Description |
|-----------|-------|-------------|
| `previousRefreshTokenHash` on sessions | A.2 | Theft detection without Redis |
| Unique permission grant | B.4 | Prevent duplicates |
| FK `invitations.acceptedByUserId` | C | Referential integrity |
| Partial unique email/username | C.3 | Soft-delete reactivation |
| `@@index([roleId])` on users | Perf | Hot join path |
| Remove or use lockout columns | C.1 | Schema honesty |
| `audit_logs.exportedAt` | D.3 | SIEM reliability (optional) |

---

## Environment variables checklist

| Variable | Phase | Required in prod |
|----------|-------|------------------|
| `SESSION_SECURITY_MODE=strict` | A.6 | Yes |
| `TOKEN_HASH_PEPPER` | A.6 | Strongly recommended |
| `TWO_FACTOR_ENCRYPTION_KEY` | A.6 | Yes if 2FA enabled |
| `TRUST_PROXY` / trusted CIDRs | A.5 | Yes behind LB |
| `REDIS_KEY_PREFIX` | AC.2 | Yes (multi-tenant) |

---

## Preserve — do not regress

These patterns are correct; extend them rather than replace:

1. Composition root in `composition.ts` — explicit wiring, no decorators.
2. Use-case driven workflows with colocated tests.
3. `packages/access` for contracts only — no runtime logic.
4. Opaque refresh tokens + hashed storage + optional HMAC pepper.
5. Refresh rotation with `FOR UPDATE` row lock.
6. `tokenVersion` for global JWT invalidation.
7. Layered login rate limits (route fail-closed + account lockout).
8. Auth plugin: JWT + session + cache revalidation + revoked markers.
9. Session security service (strict mode).
10. Transactional invite accept and password reset with race tests.
11. Argon2id password hashing + password history.
12. httpOnly refresh cookie, SameSite=strict.
13. Audit adapter + SIEM export foundation.
14. Scope cache invalidation on territory/manager changes.

---

## Overengineering — avoid

- Do not add a fourth authorization layer; consolidate snapshot at auth time if needed.
- Do not add JWT denylist until short TTL + tokenVersion proven insufficient.
- Do not microservice auth; keep modular monolith.
- Do not implement CQRS/event sourcing for audit — current audit log table is sufficient.
- Do not block Phase A on F.3 JWT asymmetric keys.

---

## Suggested execution order (sprints)

### Sprint 1 — Security blockers
A.1, A.3, A.4, A.5, A.6, AC.2, AC.3

### Sprint 2 — Session theft & authz foundation
A.2, B.1, B.4 (validation half), E.4 (email verify test)

### Sprint 3 — Compliance & tests
D.1, D.2, E.1, E.2

### Sprint 4 — Data hygiene
C.1, C.3, C.4, AC.1, AC.6

### Sprint 5 — Clinic readiness
B.2, B.3 (when schema ready), C.2 decision, D.3

### Backlog
B.4 (conditions decision), AC.4, AC.5, AC.7, AC.8, E.3, Phase F

---

## Definition of done (module ready for clinic development)

- [ ] All Phase A items complete.
- [ ] B.1 and B.2 complete; B.3 complete or stub explicitly gated behind feature flag with deny-by-default for clinic routes.
- [ ] E.1 integration tests green in CI.
- [ ] D.1 session and auth audit events emitted.
- [ ] No critical or high items remaining open in Phases A–B.

---

## References

- Module composition: `apps/api/src/modules/access/composition.ts`
- Auth plugin: `apps/api/src/modules/access/infrastructure/plugins/auth.plugin.ts`
- Scope contracts: `packages/access/src/contracts/scope-context.contract.ts`
- Cache revalidation TTL: `apps/api/src/modules/access/application/constants/cache.constants.ts`
