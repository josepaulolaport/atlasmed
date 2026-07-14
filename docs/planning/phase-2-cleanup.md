# Phase 2 — Delete the Stubs & Dead Code

**Goal:** Nothing in the UI lies to the user. Nothing in the codebase pretends to exist.  
**Rule:** Delete or hide. Do not build. If something requires building, it goes in Phase 4.  
**Status:** ✅ Complete

---

## Web UI — visible stubs

These are user-facing. Each one signals an unfinished product.

- [x] **Facility detail — commercial tab:** Remove the tab entirely from `facilities/[id]/page.tsx` until the commercial pipeline is built in Phase 4. Do not show "em breve".
- [x] **Facility detail — conformity tab:** Remove the tab entirely until conformity is wired in Phase 4. Do not show the placeholder message.
- [x] **Facility detail — territory tab:** Show the territory name, not the raw UUID. The territory name is available from the facility data or a simple lookup — this is a one-line fix, not a feature.
- [x] **Facility list — professional count:** Wire the real count from the API (added subquery to list endpoint). Remove the hardcoded `0`.
- [x] **Facility list — consultant name:** Wire the real consultant from the API (added join to list endpoint). Remove the hardcoded `—`.
- [x] **Top header — search bar:** Remove the input element entirely. It has no handler. Do not leave a decorative form element.
- [x] **Top header — notification bell:** Remove the bell and fake blue dot entirely. No functionality exists.
- [x] **Registry suggestions — "Run demo scenario" button:** Hide behind `NODE_ENV === 'development'` or remove entirely from the component. Dev tooling must not appear in production UI.

---

## Dead code — web

- [x] Delete `apps/web/components/layout/navbar.tsx` — 163 lines, never imported anywhere
- [x] Fix duplicate sidebar links: `components/layout/sidebar.tsx` has two entries pointing to `/registry-suggestions`. Remove the duplicate.
- [x] Remove `VerificationRequest` duplicate interface in `apps/web/types/api.ts` (defined twice at lines 23–26 and 54–57)

---

## Dead code — API

- [x] Delete `apps/api/src/modules/access/infrastructure/scope/stub-territory-scope.port.ts` — dead code, real `PrismaTerritoryScopePort` is wired in composition
- [x] Updated `apps/api/docs/ACCESS_AUTH_HARDENING_PLAN.md` Section B.3 to reflect that StubTerritoryScopePort has been deleted

---

## Stale documentation

- [x] Update `docs/architecture/current.md` — rewritten to reflect actual current state
- [x] Update `apps/web/README.md` — corrected roles to `ADMIN, MANAGER, REP, OPS`

---

## pt-BR string pass

Every user-facing string in the web app must be in Brazilian Portuguese. This is a mechanical pass across all files.

**Known files with English strings:**

- [x] `apps/web/contexts/auth-context.tsx` — success/error toasts in English
- [x] `apps/web/app/(dashboard)/registry-suggestions/page.tsx`
- [x] `apps/web/app/(dashboard)/sessions/page.tsx`
- [x] `apps/web/app/(dashboard)/users/page.tsx`
- [x] `apps/web/app/(dashboard)/facilities/page.tsx`
- [x] `apps/web/lib/api/client.ts` — interceptor throws English Error strings on 403/429/500
- [x] Remaining dashboard pages — full pass completed across all pages

---

## Done criteria

- No stub tabs, placeholder messages, or "em breve" visible in any page
- Facility list shows real professional count and real consultant name
- No decorative UI elements (search, bell)
- No demo/dev buttons visible in production UI
- No dead component files
- No duplicate interfaces
- All user-facing strings are in pt-BR
- Documentation reflects actual module names and roles
