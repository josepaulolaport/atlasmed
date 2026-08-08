# Meili / search — production deploy checklist

**Status:** Do **not** run against prod until this branch is merged and a deploy window is scheduled.  
**Audience:** whoever ships API + Temporal worker + Meili after the search/resilience + **compact-scope** work.

Never point `local-seed/07_*` / `08_*` at staging or production. Those scripts are local-only.

---

## What this deploy includes

Ship these capabilities together when the branch goes out (adjust if you split PRs):

| Area | Change |
|---|---|
| Worker facilities index | `streetAddress` / `neighborhood` searchable; city/state denormalized strings; **`repUserIds` filterable** |
| Worker / API | Soft-delete / deactivated → Meili delete; recurrence upsert keeps address + `repUserIds` |
| API list search | Meili empty / unparseable / hydrate-drop / oversized filter → SQL fallback; never drop scope |
| **Compact Meili scope** | REP → `repUserIds = userId`; MANAGER → `territoryIds IN oversightZoneIds` (persons: `activeTerritoryIds`); OPS keeps facility id IN |
| Observability | Logs `search.meili_fallback` / `search.meili_error`; metric `search_meili_fallback_total{index,reason}` |
| API facility writes | Upsert Meili on create/update, **rep assign/unassign/deactivate**, **zone membership / admin override** |
| Mobile | Explorar doctors `radiusKm`; multi-specialty OR; map non-200 no longer silent `[]` |
| Ops cleanup | Drop orphan Meili index `professionals` (legacy CNES UUID docs) |

**Required after deploy:** full Temporal rebuild of `facilities` (and `persons` if not already post-bigint) so every doc gains `repUserIds`. Live upserts only fix docs touched after deploy.

**Bulk territory membership recompute** (`POST` recompute-membership / boundary jobs) updates Postgres only — it does **not** Meili-upsert per clinic (timeout risk). After a bulk recompute, run Temporal `facilities` search sync if managers must see new zones in typed search immediately (SQL list path remains authority).

---

## Prerequisites

1. [ ] Prod/staging Postgres already on post-bigint CRM identity (persons + facilities bigint ids).
2. [ ] Meilisearch URL + API key available to API and Temporal worker (`MEILISEARCH_URL`, `MEILISEARCH_API_KEY`).
3. [ ] Temporal worker deployed with this branch’s `rebuild.ts` / purchase-recurrence activities.
4. [ ] API deployed with search resilience + facility search upsert.
5. [ ] Operator has permission `manage` on subject `SEARCH_SYNC` (or equivalent admin that can call sync).
6. [ ] Confirm Meili host is the **prod** instance (not local `localhost:7700`).

---

## Deploy order

1. [ ] Deploy **Temporal worker** first (or same wave as API — worker must be able to build new document shape before you trigger sync).
2. [ ] Deploy **API**.
3. [ ] Deploy mobile/web only if this release includes client changes you need live; search hardening is mostly server-side.
4. [ ] **Do not** serve traffic assuming Meili is correct until the rebuild steps below finish (API will SQL-fallback on empty/bad Meili, but rebuild is still required for quality and for new fields).

---

## Meili index rebuild (required)

Canonical path: Temporal full rebuild via API (blue-green swap inside the worker).

### 1. Facilities

```bash
# Authenticated as a user with SEARCH_SYNC manage
curl -sS -X POST "$API_BASE/api/v1/sync" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"entity":"facilities"}'
# → 202 { workflowId, runId, existing }
```

Poll:

```bash
curl -sS "$API_BASE/api/v1/sync/search-sync-facilities-full" \
  -H "Authorization: Bearer $TOKEN"
```

Wait until workflow status is completed successfully.

Expect after rebuild:

- Primary key: string decimal CRM id (not UUID).
- Searchable: name, legal/trade, document, CNES, city, state, **streetAddress**, **neighborhood**.
- Filterable: `verticalIds`, `territoryIds`, funnel fields, `_geo`, and *(compact-scope)* `repUserIds`.

### 2. Persons

```bash
curl -sS -X POST "$API_BASE/api/v1/sync" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"entity":"persons"}'
```

Poll `search-sync-persons-full` until completed.

Expect:

- Healthcare-profile persons only (ADR 0004 / Q31).
- `activeFacilityIds` / `activeTerritoryIds` populated from active associations.

### 3. Drop orphan `professionals` index

Nothing in current API/worker reads Meili `professionals` (legacy CNES UUID index). Delete on the **prod** Meili host:

```bash
curl -sS -X DELETE "$MEILISEARCH_URL/indexes/professionals" \
  -H "Authorization: Bearer $MEILISEARCH_API_KEY"
# Wait for task succeeded via GET $MEILISEARCH_URL/tasks/<taskUid>
```

Verify indexes left are only what you expect (at least `facilities`, `persons`):

```bash
curl -sS "$MEILISEARCH_URL/indexes" \
  -H "Authorization: Bearer $MEILISEARCH_API_KEY"
```

---

## Post-deploy verification

Run as ADMIN (global) and as a REP (scoped), against prod/staging.

### Auth

- [ ] `POST /api/v1/session/` with real credentials → access token.

### Facility typed search

- [ ] Search by **street** fragment known in data (e.g. a real street) → hits (ADMIN).
- [ ] Search by clinic name → hits.
- [ ] REP: only assigned clinics (after compact-scope: Meili uses `repUserIds`; before: facility id list / SQL).
- [ ] MANAGER: clinics in oversight zones (after compact-scope: `territoryIds`).

### Persons typed search

- [ ] Search by doctor name → hits.
- [ ] Scoped user does not see out-of-scope people.

### Map

- [ ] `GET /api/v1/map/facilities/points` → GeoJSON features (not empty error body).
- [ ] Mobile map: failure shows error state, not “zero clinics” when API is down.

### Soft-delete / index hygiene (staging preferred)

- [ ] Soft-delete a test facility → document gone from Meili `facilities` (or absent after next upsert/rebuild).
- [ ] *(compact-scope)* Assign/unassign REP → search visibility updates without waiting for full rebuild.

### Observability

- [ ] Metric `search_meili_fallback_total` scraped (labels `index` ∈ facilities|persons, `reason` bounded).
- [ ] During rebuild or Meili blip, logs may show `search.meili_fallback` / `search.meili_error` while SQL still returns data — that is expected degrade, not outage.

---

## Failure / rollback notes

| Symptom | Action |
|---|---|
| Sync workflow fails | Check Temporal UI for `search-sync-facilities-full` / `persons-full`; fix worker/Meili; re-POST `/api/v1/sync`. Old stable index stays until successful swap. |
| Street search empty but SQL would match | Rebuild not done or recurrence wiped fields on old worker — confirm worker version + re-run facilities sync. |
| Scoped user sees nothing / wrong set | Confirm role filters (REP vs MANAGER); check `repUserIds` / `territoryIds` on a sample Meili doc; SQL path still enforces scope. |
| Need to abort release | Redeploy previous API/worker; Meili may still have new fields (harmless). Re-run full sync only if document shape must match the rolled-back worker. |
| Accidentally used local seed scripts on prod | Stop; treat as incident; restore Meili from full Temporal rebuild only. |

---

## Explicit non-actions

- Do **not** run `drizzle-kit push` / local seed SQL against prod.
- Do **not** manually edit Meili settings to “match local” without going through worker `FACILITY_SETTINGS` / `PERSON_SETTINGS`.
- Do **not** recreate a `professionals` Meili index.
- Grants / exceptional access in Meili: **not** part of this cutover.

---

## Checklist summary (copy for the deploy ticket)

```
[ ] Worker deployed (this branch)
[ ] API deployed (this branch)
[ ] POST /api/v1/sync entity=facilities → completed
[ ] POST /api/v1/sync entity=persons → completed
[ ] DELETE Meili index professionals → succeeded
[ ] Smoke: login, street search, name search, persons search, map points
[ ] Smoke: REP + MANAGER scoped search (if compact-scope shipped)
[ ] Metrics/logs: search_meili_fallback_total visible
[ ] No local-seed scripts used against this environment
```

---

## Related code

- Worker rebuild: `apps/workers/temporal/src/search/rebuild.ts`
- Recurrence Meili upsert: `apps/workers/temporal/src/activities/purchase-recurrence.activities.ts`
- API facility upsert: `apps/api/src/infrastructure/search/facility-search-index.service.ts`
- Resilience: `apps/api/src/infrastructure/search/search-resilience.ts`
- Sync API: `POST /api/v1/sync` (`apps/api/src/modules/search-sync`)
