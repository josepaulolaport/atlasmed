# Phase 0 — Foundation

**Goal:** Make the project trustworthy. Tests mean something. The linter runs. The seed works. Errors are typed.  
**Rule:** No new features. No UI changes. No schema changes.  
**Status:** ⬜ Not started

---

## CI

- [ ] Delete `.github/workflows/backend-ci.yml` (watches `backend/` which doesn't exist)
- [ ] Delete `.github/workflows/web-ci.yml` (watches `web/` which doesn't exist)
- [ ] Delete `.github/workflows/mobile-ci.yml` (watches `mobile/` which doesn't exist)
- [ ] Rewrite `test.yml` to cover the actual monorepo:
  - [ ] API: typecheck + `bun test` (already works — verify it's green)
  - [ ] Web: `bun run build` (catches broken imports and type errors)
  - [ ] Workers: typecheck + `bun test`
  - [ ] Packages: typecheck for `packages/access`, `packages/database`
- [ ] Ensure CI fails (not skips) when test DB is unavailable — see test fix below

## Integration test guard

All `*-http.integration.test.ts` files and `access-auth.integration.test.ts` use `if (!dbReady) return` which silently passes tests when PostgreSQL/Redis are unavailable. CI can be green with zero assertions.

- [ ] Replace `if (!dbReady) return` pattern with `if (!dbReady) throw new Error("Test DB not ready — cannot run integration tests")`
- [ ] Confirm affected files:
  - `access-http.integration.test.ts`
  - `access-auth.integration.test.ts`
  - `access-auth-security.integration.test.ts`
  - `access-scope-and-assignments.integration.test.ts`
  - `facility-http.integration.test.ts`
  - `professional-http.integration.test.ts`
  - `territory-http.integration.test.ts`
  - `registry-ingestion-http.integration.test.ts`
  - `maps-http.integration.test.ts`
  - `catalog-http.integration.test.ts`
  - `cnes-ingestion-worker.integration.test.ts`
  - `refresh-session.race-condition.test.ts`
  - `accept-invite.race-condition.test.ts`
  - `reset-password.race-condition.test.ts`
  - `login.race-condition.test.ts`

## ESLint scope

- [ ] Update `apps/api/package.json` lint script from `eslint src/app` to `eslint src`
- [ ] Run lint and fix all errors before marking complete

## `packages/access` typecheck script

`packages/access/package.json` has no `scripts` block. CI cannot run typecheck on it without one.

- [ ] Add `"scripts": { "typecheck": "tsc --noEmit" }` to `packages/access/package.json`
- [ ] Ensure `packages/access` has a `tsconfig.json` (create one if missing)

## Seed script

- [ ] `apps/api/src/infrastructure/database/seed.ts`: rename `USER` → `REP`
- [ ] `apps/api/src/infrastructure/database/seed.ts`: add `OPS` role entry
- [ ] Verify seed runs cleanly on a fresh DB

## Raw `Error()` throws → typed domain errors

Replace every raw `throw new Error(...)` in production code with the appropriate typed error from `apps/api/src/shared/errors/`.

### Module code

| File | Current | Replace with |
|---|---|---|
| `modules/access/application/use-cases/revoke-invite.use-case.ts:22` | `"Invite not found"` | `ResourceNotFoundError` |
| `modules/access/application/use-cases/revoke-invite.use-case.ts:26` | `"Only pending invites can be revoked"` | `ValidationError` |
| `modules/access/application/services/two-factor.service.ts:68` | `"TWO_FACTOR_ENCRYPTION_KEY is not configured"` | `ConfigurationError` |
| `modules/access/infrastructure/repositories/drizzle/drizzle-invite.repository.ts` | `"User already exists"` | `ConflictError` |
| `modules/professional/infrastructure/repositories/drizzle/drizzle-professional.repository.ts` | `"Professional not found"` | `ResourceNotFoundError` |
| `modules/registry-ingestion/application/use-cases/run-registry-ingestion.use-case.ts:62` | `"Temporal workflow starter is not configured"` | `ConfigurationError` |
| `modules/registry-ingestion/application/use-cases/suggestion.use-cases.ts:272` | `"professionalRepository is required"` | `ConfigurationError` |
| `modules/registry-ingestion/application/use-cases/suggestion.use-cases.ts:299` | `"facilityRepresentativeRepository is required"` | `ConfigurationError` |
| `modules/registry-ingestion/application/use-cases/suggestion.use-cases.ts:332` | `"facilityRepresentativeRepository is required"` | `ConfigurationError` |
| `modules/territory/application/constants/territory-roles.constants.ts:22` | manager zone constraint | `ValidationError` |
| `modules/territory/application/constants/territory-roles.constants.ts:26` | rep patch constraint | `ValidationError` |
| `modules/territory/application/use-cases/territory-crud.use-cases.ts:85` | missing territoryType | `ValidationError` |

### Infrastructure code

| File | Current | Replace with |
|---|---|---|
| `infrastructure/external-services/resend/resend-email.service.ts` | `"Failed to send email"` | `ExternalServiceError` |
| `infrastructure/external-services/resend/send-invite-email.ts` (×2) | `"Failed to send invite/reset email"` | `ExternalServiceError` |
| `infrastructure/external-services/twilio/twilio-messaging.service.ts` | `"Failed to send WhatsApp message"` | `ExternalServiceError` |
| `infrastructure/audit/siem-export.helper.ts` | `"SIEM webhook returned ${status}"` | `ExternalServiceError` |
| `infrastructure/jobs/territory-membership.queue.ts` | `"Territory membership handler not registered"` | `ConfigurationError` |

- [ ] Create `ConfigurationError` in `apps/api/src/shared/errors/domain-errors.ts` if it doesn't exist
- [ ] Replace all throws in both tables above
- [ ] Verify global error handler maps each new error type to the correct HTTP status

## `any` types in repository interfaces

`apps/api/src/modules/access/application/interfaces/` has 11 `any` usages across `session.repository.interface.ts`, `user.repository.interface.ts`, and `invite.repository.interface.ts`. These are the ones already listed as P3-5 in the problem inventory (location was wrong — they are in `apps/api`, not `packages/access`; `packages/access` is clean).

- [ ] Replace `any` with proper domain types in all three interface files
- [ ] Run typecheck to confirm no regressions

## Role name fix in tests

- [ ] `packages/access/src/...permission.middleware.test.ts`: replace `"USER"` with `"REP"` everywhere
- [ ] Run access tests — all must pass

## Done criteria

All checkboxes above are checked. `bun test` in CI passes with real assertions. `bun run build` passes for web. Seed runs cleanly. No raw `Error()` in module or infra code. Typecheck passes for all packages.
