# Phase 0 — Foundation

**Goal:** Make the project trustworthy. Tests mean something. The linter runs. The seed works. Errors are typed.  
**Rule:** No new features. No UI changes. No schema changes.  
**Status:** ✅ Complete

---

## CI ✅

- [x] Delete `.github/workflows/backend-ci.yml` (watches `backend/` which doesn't exist)
- [x] Delete `.github/workflows/web-ci.yml` (watches `web/` which doesn't exist)
- [x] Delete `.github/workflows/mobile-ci.yml` (watches `mobile/` which doesn't exist)
- [x] Rewrite `test.yml` to cover the actual monorepo:
  - [x] API: typecheck + `bun test`
  - [x] Web: `bun run build`
  - [x] Workers: typecheck + `bun test`
  - [x] Packages: typecheck for `packages/access`, `packages/database`
- [x] Ensure CI fails (not skips) when test DB is unavailable

## Integration test guard ✅

- [x] Replace `if (!dbReady) return` with `throw new Error("Test DB not ready — cannot run integration tests")` in all integration test files

## ESLint scope ✅

- [x] Updated `apps/api/package.json` lint script from `eslint src/app` to `eslint src`

## `packages/access` typecheck script ✅

- [x] Added `"typecheck": "tsc --noEmit"` to `packages/access/package.json`
- [x] `packages/access/tsconfig.json` confirmed present

## Seed script ✅

- [x] Renamed `USER` → `REP` in seed
- [x] Added `OPS` role entry
- [x] Seed verified on fresh DB

## Raw `Error()` throws → typed domain errors ✅

- [x] Created `ConfigurationError` in `apps/api/src/shared/errors/domain-errors.ts`
- [x] Replaced all raw throws in module code with typed errors
- [x] Replaced all raw throws in infrastructure code
- [x] Global error handler maps each new type to correct HTTP status

## `any` types in repository interfaces ✅

- [x] Replaced all `any` in session, user, invite, and password-reset interfaces
  with proper domain types (`UserRecord`, `SessionRecord`, `SessionWithUserRecord`,
  `InviteRecord`, `PasswordResetRecord`, `PasswordResetWithUserRecord`)
- [x] Typecheck passes: 0 errors in `apps/api`

## Role name fix ✅

- [x] Replaced `"USER"` with `"REP"` everywhere (API tests, web components,
  validators, CASL subject references)

## Done criteria

All checkboxes above are checked. `bun test` in CI passes with real assertions. `bun run build` passes for web. Seed runs cleanly. No raw `Error()` in module or infra code. Typecheck passes for all packages.
