# Phase 4 — Feature Completion

**Goal:** Finish one feature completely before touching the next. Backend hardening → frontend → tests → pt-BR → done.  
**Rule:** A feature is not done until all four layers are complete. No partial shipping.  
**Status:** ⬜ Not started

Each feature section has its own checklist. Work through them in order.

> **Healthcare sectors:** Schema prep is in Phase 1. Application enforcement is Phase 3 §6. UI surfaces for sector management appear in §4.1 and §4.8 below.

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

> **Deferred.** VISIT was removed from CASL in Phase 1. Build when product prioritizes field visit tracking.

**Scope:** Build the full visit tracking domain from scratch.

**Backend:**
- [ ] Define `Visit` Drizzle model (see draft in phase-1-db-observability.md legacy section)
- [ ] Create migration
- [ ] Re-add `VISIT` CASL subject with role abilities
- [ ] Build visit module: repository, use-cases, routes
- [ ] Scope enforcement: REP sees own visits; MANAGER sees reports'; ADMIN/OPS read-all
- [ ] Unit + integration tests

**Frontend:**
- [ ] `/visits` list + create form
- [ ] Visit history on facility detail
- [ ] pt-BR strings; loading/error/empty states

---

## 4.7 — IngestionDiff viewer

> **Kept in Phase 1.** Build read API here (`cnes_diffs` table).

**Scope:** Expose the stored ingestion diffs via API so they can be viewed in the admin UI.

**Backend:**
- [ ] Add `GET /registry-ingestion/runs/:id/diff` route
- [ ] Add use-case and repository implementation for reading diffs
- [ ] Add integration test

**Frontend:**
- [ ] Wire diff view into the ingestion run detail view (built in 4.3)
- [ ] All strings in pt-BR

---

## 4.8 — Healthcare sector management UI

> **Depends on Phase 3 §6** (sector scope enforcement). Schema exists from Phase 1.

**Scope:** Admin/manager surfaces for sectors beyond basic catalog CRUD — tying sectors to users and territories.

**Backend (if not done in Phase 3):**
- [ ] `GET/POST/DELETE /access/users/:id/sectors` — list and manage user sector assignments
- [ ] Territory admin: require `sectorId` when creating manager zones and rep patches

**Frontend:**
- [ ] User detail / invite: multi-select healthcare sectors (uses existing `sectors` catalog)
- [ ] Territory admin: sector picker on create/edit territory forms
- [ ] Facility list: sector badge + filter (for managers with multiple sectors)
- [ ] Dashboard/header: active sector context indicator when user has multiple sectors (optional UX polish)
- [ ] pt-BR labels ("Setor", "Setores de atuação", etc.)

**Tests:**
- [ ] E2E: create manager with two sectors, assign territories in each, verify list scoping

---

## Notes

- Features 4.1–4.4 have complete backends. They are frontend-completion tasks.
- Features 4.5–4.8 require backend work too.
- **Sector scoping:** Phase 3 §6 (enforcement) must ship before or with 4.8 UI.
- Do not start a feature until the previous one's checklist is fully checked.
- After each feature, update `PLAN.md` Feature Inventory.
