# AtlasMed Recovery Plan

**Created:** 2026-07-09  
**Last updated:** 2026-07-10  
**Status:** Phase 1 (DB) complete → Phase 0 next

This document is the single source of truth for the project recovery. Update it as work progresses. Every checkbox represents a concrete task. Every phase must be fully checked before the next one begins.

---

## Navigation

| File | Contents |
|---|---|
| `PLAN.md` (this file) | Master overview, feature inventory, problem inventory, phase summary |
| `phase-0-foundation.md` | CI, tests, linting, seed, raw errors |
| `phase-1-db-observability.md` | Database schema review + changes, observability wiring |
| `phase-2-cleanup.md` | Delete stubs, dead code, decorative UI |
| `phase-3-contracts.md` | Contract bugs, invite flow fix, selector fixes |
| `phase-4-features.md` | Feature completion, one at a time |
| `backlog.md` | Deferred items: design system, RSC, TanStack Query, Temporal versioning |

---

## Feature Inventory

### Complete (backend + frontend)

- Auth: login, 2FA, register, password reset
- Auth: session management
- Auth: profile edit
- Auth: email/phone verification and change flows
- Auth: user CRUD (activate, deactivate, suspend, unsuspend)
- Auth: role and permission management
- Auth: capabilities endpoint
- Professionals: full CRUD + facility links
- Territory: CRUD, hierarchy tree, reparent
- Territory: territory types CRUD
- Territory: approval requests
- Territory: unassigned facilities
- Territory: boundary editor
- Registry suggestions: approve/reject

### Partial (backend complete, frontend incomplete or stubbed)

- Facilities: CRUD — complete. Detail page has 3 stub tabs (conformity, commercial, territory raw UUID).
- Facilities: professional list/count — hardcoded `0` in list view
- Facilities: consultant name — hardcoded `—` in list view
- Facilities: registry data (raw CNES sync) — backend complete, no web UI
- Facilities: consultant assignments — backend complete, no web UI
- Facilities: conformity records — backend complete, web is a stub tab
- Registry ingestion: run + monitor — backend complete, no admin UI
- Health page: reads only `/health`, ignores live/ready/metrics probes

### Backend only (no web UI)

- Catalog: sectors, products, healthcare providers, facility provider shares (full CRUD exists, zero pages)

### Not built

- Facilities: commercial pipeline — web shows "em breve"
- Visit domain — CASL permissions defined, no model, no routes, no UI
- Organization model — FK exists in Territory, no model
- BI / operations dashboard — route exists, shows user count only

### Broken / half-wired

- Invite flow: web sends assignment fields, API drops them silently
- Manager selector: uses `?role=MANAGER` query param the API ignores
- Territory selector in invite: uses `?type=` and `?managerTerritoryId=` the API ignores
- OPS role: in enum and migration, empty scope (sees nothing), missing from role priority
- VISIT CASL subject: permissions and tests exist, no domain behind them

---

## Problem Inventory

### P1 — Critical

| # | Problem | Location |
|---|---|---|
| P1-1 | Invite route drops `firstName`, `lastName`, `managerId`, territory assignments | `invite-user.route.ts` |
| P1-2 | Manager/territory selectors use query params the API ignores | `lib/api/territories.ts`, `lib/api/users.ts` |
| P1-3 | Integration tests pass silently when DB is unavailable | All `*-http.integration.test.ts` |
| P1-4 | Seed script creates role `REPRESENTATIVE` (not `REP`), missing `OPS` | `seed.ts` |
| P1-5 | OPS role has empty scope — sees nothing despite read permissions | `packages/access`, scope resolvers |

### P2 — High

| # | Problem | Location |
|---|---|---|
| P2-1 | 12 raw `Error()` throws become opaque 500s | 8 files across modules |
| P2-2 | No `middleware.ts` — auth is entirely client-side in web | `apps/web` |
| P2-3 | Facility detail shows 3 stub tabs to real users | `facilities/[id]/page.tsx` |
| P2-4 | Facility list shows hardcoded `0` professionals and `—` consultant | `facilities/page.tsx` |
| P2-5 | English strings in toasts/errors throughout a pt-BR app | 20+ files |
| P2-6 | CI: 3 of 4 workflows watch non-existent paths (`backend/`, `web/`, `mobile/`) | `.github/workflows/` |
| P2-7 | Workers never run in CI | `.github/workflows/test.yml` |

### P3 — Medium

| # | Problem | Location |
|---|---|---|
| P3-1 | ~20 runtime files use `console.*` instead of structured logger | cache services, jobs, external services, `app.ts` |
| P3-2 | `@atlasmed/observability` built but never imported anywhere | All apps |
| P3-3 | Dual config systems: TypeBox in API vs Zod in `packages/config`; web config files empty | `packages/config`, `environment.ts` |
| P3-4 | ESLint only covers `src/app` — 95% of API source is unlinted | `apps/api/package.json` |
| P3-5 | Access repository interfaces use pervasive `any` types | `user/session/invite/password-reset.repository.interface.ts` |
| P3-6 | Auth context re-bootstraps on every route change | `auth-context.tsx` |
| P3-7 | VISIT CASL subject has no domain (no model, no routes) | `packages/access` |
| P3-8 | `packages/access` tests reference old role name `USER` instead of `REP` | `permission.middleware.test.ts` |
| P3-9 | MANAGER role lacks registry ingestion permissions | `packages/access` |
| P3-10 | Temporal workflow has no versioning/patch guards | `apps/workers` |

### P4 — Low / Cleanup

| # | Problem | Location |
|---|---|---|
| P4-1 | Dead `navbar.tsx` (163 lines, never imported) | `components/layout/navbar.tsx` |
| P4-2 | Duplicate sidebar entries pointing to the same route | `components/layout/sidebar.tsx` |
| P4-3 | Decorative search bar with no handler | `components/layout/top-header.tsx` |
| P4-4 | Decorative notification bell with fake blue dot | `components/layout/top-header.tsx` |
| P4-5 | "Run demo scenario" button in production UI | `registry-suggestions/page.tsx` |
| P4-6 | `StubTerritoryScopePort` dead code, referenced in stale docs | `access/infrastructure/scope/` |
| P4-7 | Two icon systems (iconify vs lucide), two color palettes (zinc vs gray) | 30+ component files |
| P4-8 | All 28 dashboard pages are `"use client"` — no RSC benefits | `apps/web/app/(dashboard)/` |
| P4-9 | Facility territory tab shows raw UUID | `facilities/[id]/page.tsx` |
| P4-10 | Stale README: documents `ADMIN, MANAGER, USER`; actual roles are `ADMIN, MANAGER, REP, OPS` | `apps/web` README |
| P4-11 | Duplicate `VerificationRequest` interface | `types/api.ts` |
| P4-12 | `docs/architecture/current.md` references old module names (`clinic`, `doctor`) | `docs/architecture/current.md` |

---

## Phase Summary

| Phase | Focus | Status |
|---|---|---|
| **Phase 0** | Foundation: CI, tests, linting, seed, raw errors | 🔜 Next |
| **Phase 1** | DB schema decisions + SigNoz/OTEL wiring + dev/staging/prod environment setup | 🟡 DB done — observability/env pending |
| **Phase 2** | Delete stubs, dead code, decorative UI | ⬜ Not started |
| **Phase 3** | Contract bugs: invite flow, selectors, OPS role | ⬜ Not started |
| **Phase 4** | Feature completion, one at a time | ⬜ Not started |
| **Backlog** | Design system, RSC, TanStack Query, Temporal versioning | ⬜ Deferred |

---

## Rules

1. A phase is complete only when every checkbox in its file is checked.
2. No new features until Phase 3 is complete.
3. Every task in Phase 4 follows the same pattern: backend hardening → frontend → tests → pt-BR strings → done.
4. When a schema change is made in Phase 1, update `packages/database/AGENTS.md` and this file.
5. When a feature is completed in Phase 4, mark it complete in the Feature Inventory above.
