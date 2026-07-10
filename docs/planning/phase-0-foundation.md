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

## ESLint scope

- [ ] Update `apps/api/package.json` lint script to cover all of `src/` (not just `src/app`)
- [ ] Run lint and fix all errors before marking complete

## Seed script

- [ ] `apps/api/src/infrastructure/database/seed.ts`: rename `REPRESENTATIVE` → `REP`
- [ ] `apps/api/src/infrastructure/database/seed.ts`: add `OPS` role entry
- [ ] Verify seed runs cleanly on a fresh DB

## Raw `Error()` throws → typed domain errors

Replace every raw `throw new Error(...)` in production module code with the appropriate typed error from `apps/api/src/shared/errors/`.

| File | Current | Replace with |
|---|---|---|
| `modules/access/application/use-cases/revoke-invite.use-case.ts:22` | `"Invite not found"` | `ResourceNotFoundError` |
| `modules/access/application/use-cases/revoke-invite.use-case.ts:26` | `"Only pending invites can be revoked"` | `ValidationError` or domain-specific |
| `modules/access/application/services/two-factor.service.ts:68` | `"TWO_FACTOR_ENCRYPTION_KEY is not configured"` | `ConfigurationError` (create if missing) |
| `modules/access/infrastructure/repositories/prisma/prisma-invite.repository.ts:238` | `"User already exists"` | `ConflictError` |
| `modules/professional/infrastructure/repositories/prisma/prisma-professional.repository.ts:314` | `"Professional not found"` | `ResourceNotFoundError` |
| `modules/registry-ingestion/application/use-cases/run-registry-ingestion.use-case.ts:62` | `"Temporal workflow starter is not configured"` | `ConfigurationError` |
| `modules/registry-ingestion/application/use-cases/suggestion.use-cases.ts:272` | `"professionalRepository is required"` | `ConfigurationError` |
| `modules/registry-ingestion/application/use-cases/suggestion.use-cases.ts:299` | `"facilityRepresentativeRepository is required"` | `ConfigurationError` |
| `modules/registry-ingestion/application/use-cases/suggestion.use-cases.ts:332` | `"facilityRepresentativeRepository is required"` | `ConfigurationError` |
| `modules/territory/application/constants/territory-roles.constants.ts:22` | manager zone constraint | `ValidationError` |
| `modules/territory/application/constants/territory-roles.constants.ts:26` | rep patch constraint | `ValidationError` |
| `modules/territory/application/use-cases/territory-crud.use-cases.ts:85` | missing territoryType | `ValidationError` |

- [ ] Create `ConfigurationError` in `apps/api/src/shared/errors/` if it doesn't exist
- [ ] Replace all 12 throws listed above
- [ ] Verify global error handler maps each new error type to the correct HTTP status

## Role name fix in tests

- [ ] `packages/access/src/...permission.middleware.test.ts`: replace `"USER"` with `"REP"` everywhere
- [ ] Run access tests — all must pass

## Done criteria

All checkboxes above are checked. `bun test` in CI passes with real assertions. `bun run build` passes for web. Seed runs cleanly. No raw `Error()` in module code.
