# Phase 4 — Feature Completion

**Goal:** Finish one feature completely before touching the next. Backend hardening → frontend → tests → pt-BR → done.  
**Rule:** A feature is not done until all four layers are complete. No partial shipping.  
**Status:** ⬜ Not started

Each feature section has its own checklist. Work through them in order.

---

## Feature template

For every feature below, complete in this order:

1. **Backend hardening:** typed errors, scope enforcement, OpenAPI `detail` blocks, use-case unit tests
2. **Frontend:** real data (no hardcoded values), all states handled (loading, empty, error), no stubs
3. **Integration tests:** HTTP integration tests for happy path + key error paths
4. **pt-BR:** all strings in the feature are in Brazilian Portuguese
5. **Mark done** in `PLAN.md` Feature Inventory

---

## 4.1 — Catalog UI

**Scope:** Build admin pages for sectors, products, healthcare providers, and facility provider shares.  
The entire backend is already complete. This is frontend-only work.

**Backend hardening:**
- [ ] Add OpenAPI `detail` blocks to all catalog routes (currently missing)
- [ ] Add use-case unit tests for `catalog.use-cases.ts` (currently zero)
- [ ] Add integration test cases for products, healthcare-providers, and shares (currently only sectors have INT tests)

**Frontend — pages to build:**
- [ ] `/catalog/sectors` — list, create, edit sectors
- [ ] `/catalog/products` — list, create, edit products (with sector association)
- [ ] `/catalog/healthcare-providers` — list, create, edit providers
- [ ] `/facilities/[id]` — wire healthcare-provider-shares into facility detail (existing empty area)
- [ ] Add "Catálogo" section to sidebar navigation

**Frontend requirements:**
- [ ] All pages protected with appropriate CASL permission check (`canManageCatalog` or similar)
- [ ] All strings in pt-BR
- [ ] All loading/error/empty states handled

---

## 4.2 — Facility: conformity

**Scope:** Wire the conformity tab in facility detail with real data.  
Backend: `GET /conformity/requirements`, `GET/POST /facilities/:id/conformity-records`.

**Backend hardening:**
- [ ] Add use-case unit tests for conformity use-cases (currently none)
- [ ] Add integration tests for conformity endpoints (currently none)
- [ ] Verify scope enforcement — conformity records must respect facility scope

**Frontend:**
- [ ] Restore conformity tab in `facilities/[id]/page.tsx` (it was hidden in Phase 2)
- [ ] Display requirements list with pass/fail status per requirement
- [ ] Allow creating/updating conformity records
- [ ] All strings in pt-BR
- [ ] All loading/error/empty states handled

---

## 4.3 — Registry ingestion admin UI

**Scope:** Build the page to trigger ingestion runs and monitor their status.  
Backend: `POST /registry-ingestion/run`, `GET /registry-ingestion/runs`, `GET /registry-ingestion/runs/:id/status`.

**Backend hardening:**
- [ ] Add integration tests for run and monitor endpoints (currently none beyond suggestions)
- [ ] Verify the `run` endpoint returns a typed error when Temporal is not configured (raw Error fixed in Phase 0)

**Frontend:**
- [ ] Build `/registry-ingestion` admin page (ADMIN only)
- [ ] Show list of ingestion runs with status, timestamps, and stats
- [ ] Allow triggering a new run with optional parameters (year/month override)
- [ ] Show live status polling for a running job
- [ ] Add to sidebar under "Administração"
- [ ] All strings in pt-BR
- [ ] All loading/error/empty states handled

---

## 4.4 — Facility: consultant assignments

**Scope:** Show and manage which rep is assigned to a facility and when.  
Backend: `GET/POST /facilities/:id/consultant-assignments`.

**Backend hardening:**
- [ ] Add use-case unit tests for consultant assignment use-case (currently none)
- [ ] Add integration tests for consultant assignment endpoints (currently none)
- [ ] Verify scope enforcement

**Frontend:**
- [ ] Wire consultant assignment list into facility detail (replace the hardcoded `—` fixed in Phase 2)
- [ ] Allow creating a new assignment (assign a rep to a facility)
- [ ] Allow viewing assignment history
- [ ] All strings in pt-BR
- [ ] All loading/error/empty states handled

---

## 4.5 — Facility: registry data view

**Scope:** Show the raw CNES registry data for a facility alongside its CRM record.  
Backend: `GET /facilities/:id/registry/facility`, `GET /facilities/:id/registry/professionals`, `GET /facilities/:id/registry/representatives`.

**Backend hardening:**
- [ ] Add integration tests for registry sub-routes (currently none)
- [ ] Verify scope enforcement — registry view should respect facility access

**Frontend:**
- [ ] Add a "Cadastro CNES" tab to facility detail showing the raw registry data
- [ ] Show registry professionals and representatives with confirm/associate actions
- [ ] All strings in pt-BR
- [ ] All loading/error/empty states handled

---

## 4.6 — Visit domain

> **Depends on Phase 1 decision.** If VISIT was removed from `packages/access` in Phase 1, skip this section. If deferred, build it now.

**Scope:** Build the full visit tracking domain from scratch.

**Backend:**
- [ ] Define `Visit` Prisma model (see schema draft in phase-1-db-observability.md)
- [ ] Create migration
- [ ] Build visit module: repository interface, Prisma implementation, use-cases, routes
- [ ] Scope enforcement: REP sees only their own visits, MANAGER sees reports' visits, ADMIN sees all
- [ ] Unit tests for use-cases
- [ ] Integration tests for HTTP routes

**Frontend:**
- [ ] `/visits` page — list visits with filters (by rep, by facility, by date, by outcome)
- [ ] Create visit form (facility, date, notes, outcome)
- [ ] Visit history on facility detail page
- [ ] All strings in pt-BR
- [ ] All loading/error/empty states handled

---

## 4.7 — IngestionDiff viewer

> **Depends on Phase 1 decision.** If IngestionDiff model was removed in Phase 1, skip this. If kept, build the read API here.

**Scope:** Expose the stored ingestion diffs via API so they can be viewed in the admin UI.

**Backend:**
- [ ] Add `GET /registry-ingestion/runs/:id/diff` route
- [ ] Add use-case and repository implementation for reading diffs
- [ ] Add integration test

**Frontend:**
- [ ] Wire diff view into the ingestion run detail view (built in 4.3)
- [ ] All strings in pt-BR

---

## Notes

- Features 4.1–4.4 have complete backends. They are frontend-completion tasks.
- Features 4.5–4.7 require backend work too.
- Do not start a feature until the previous one's checklist is fully checked.
- After each feature, update `PLAN.md` Feature Inventory.
