# Spec 0007: Não Conformidades — Tasks

**Status:** Ready to execute — product decisions locked.  
**Order:** follow [api-mobile integration](../../ai/integration-tasks/api-mobile.md) — contract → schema → API → mobile → docs.

**Locked decisions:**
- User-submitted only → `public.field_suggestions` (no CNES / registry-ingestion coupling).
- MANAGER may self-approve (scope enforced); REP cannot approve.
- v1 = administrative field edits + deactivation; **no** `commercialStatus`.
- **Supersede:** on create, auto-reject older matching `PENDING` (same facility + `field_key`, or same facility + `DEACTIVATION`).
- Always call `onFacilityLocationChanged` after successful address geocode.

---

## Phase 0 — Align docs

- [x] `docs/specs/0007-nao-conformidades/requirements.md`
- [x] `docs/specs/0007-nao-conformidades/design.md`
- [x] `docs/specs/0007-nao-conformidades/tasks.md`
- [x] Point Spec 0005 F-015 Phase 2 at Spec 0007 (facility, user-only store)
- [ ] Optional: short `docs/architecture/features/nao-conformidades.md` linking API surfaces

---

## Phase 1 — Geocoding foundation

Goal: address → point works for NC accept (and reusable facility update helpers).

- [x] Extend `FacilityGeocodingService` to call `GeocodingPort.forwardGeocode` from structured address parts
- [x] Compose Brazilian address query string (omit empty segments); default `country: "br"`
- [x] Unit tests: coords provided → no Mapbox; address only → geocode; geocode null → null coords
- [x] Wire real adapter in facility / field-suggestions composition (fail closed in prod if token missing when geocode required)
- [x] Ensure facility apply helper accepts address parts + location (via `applyApprovedFieldUpdates`)

---

## Phase 2 — Database

- [x] Add enums + `field_suggestions` table under `packages/database/src/schema/public/`
- [x] Indexes for ops queue, mine list, and supersede lookups
- [x] Export types from package index
- [x] `bunx drizzle-kit generate --name="field_suggestions"` → `drizzle/0012_field_suggestions.sql`
- [x] Review SQL; migrate local DB
- [ ] Commit schema + migration together

---

## Phase 3 — Access

- [x] Add `FIELD_SUGGESTION` subject
- [x] Role rules: REP create; MANAGER create+review incl. self-approve (scoped); ADMIN all; REP cannot approve; OPS read+update (no create)
- [ ] Dedicated `packages/access` unit cases for FIELD_SUGGESTION (optional polish)

---

## Phase 4 — API module `field-suggestions`

### 4.1 Ports & repository

- [x] `FieldSuggestionRepository` (createWithSupersede, findById, list, resolve)
- [x] Facility apply helper for administrative allow-list + address + location + `manuallyEditedAt`

### 4.2 Use-cases

- [x] `CreateFacilityFieldSuggestionUseCase` (snapshot, validate, **supersede**, audit)
- [x] `ListFieldSuggestionsUseCase` (ops + mine)
- [x] `GetFieldSuggestionUseCase`
- [x] `ApproveFieldSuggestionUseCase` (geocode for address + location hook + audit; self-approve via CASL)
- [x] `RejectFieldSuggestionUseCase`
- [x] Unit tests: unknown field / commercialStatus rejected; create path; approve non-pending; apply geocode success/fail

### 4.3 Routes & composition

- [x] `POST/GET /facilities/:id/field-suggestions`
- [x] `GET /field-suggestions`, `GET /field-suggestions/:id`
- [x] `POST /field-suggestions/:id/approve`, `.../reject`
- [x] OpenAPI tags: `FieldSuggestions`
- [x] Register module in app router
- [ ] HTTP integration tests: happy path, 401, 403 scope, 422 geocode fail, supersede, double approve

---

## Phase 5 — Mobile wire-up

- [x] DTO models + JSON parsing (`field_suggestion_mapper.dart`)
- [x] API client on session HTTP stack (`FieldSuggestionsRepository`)
- [x] Replace in-memory provider with API-backed providers + cache
- [x] Wire pencils + address sheet → create
- [x] Wire deactivation sheet → `DEACTIVATION`
- [x] Ops list/detail → approve/reject (`canReview: true`)
- [x] Establishment own list → `mine=true` (`canReview: false`)
- [x] Error UX (geocode / validation snackbars)
- [x] Remove mock seeds / `nao_conformidade_mock.dart`
- [ ] Smoke against local API

---

## Phase 6 — Hardening & docs closeout

- [ ] Audit event map (`created` / `superseded` / `approved` / `rejected`)
- [ ] Cross-link Spec 0002 / 0005 if wording drifted
- [ ] Optional architecture feature doc
- [ ] CI green before merge

---

## Suggested PR slices

| PR | Contents |
|---|---|
| 1 | Spec docs (this planning slice) |
| 2 | Geocoding service + tests |
| 3 | Schema migration + access subject |
| 4 | API module + integration tests (incl. supersede) |
| 5 | Mobile wire-up replacing mock |

---

## Definition of done (v1)

1. Users can submit administrative field + deactivation suggestions from mobile against a real facility id.
2. Resubmitting the same field (or a second deactivation) auto-rejects the older `PENDING` row(s).
3. Reviewers (MANAGER/ADMIN, including self) can approve/reject; facility mutates only on approve; REP cannot review.
4. Address accept updates address columns **and** `location` via Mapbox; location-changed hook runs.
5. Failed geocode leaves suggestion `PENDING` with no partial apply.
6. No CNES / registry-ingestion code paths are used.
7. Spec 0007 status updated when implemented.
