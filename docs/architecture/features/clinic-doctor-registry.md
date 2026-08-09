# Feature: Facility and Person CRM

## Current State

AtlasMed has clinic and person CRM support: facilities, unified `persons` with facility affiliations, healthcare vs administrative classifications, role assignments, private notes, relationship scores, Meilisearch indexes (`facilities` + `persons`), and purchase-recurrence snapshots. CNES registry warehouse ingest and `/registry/*` READ/confirm are **removed**.

User-submitted field corrections and deactivation requests use `public.field_suggestions` (Não Conformidades) — see Spec 0007. That path is not a CNES registry suggestion queue.

Person model design: [ADR 0004](../adr/0004-person-facility-model.md).

## Current Data Concepts

- **Facility** — Pessoa Jurídica (CNPJ) or Pessoa Física (CPF), discriminated by `legal_document_type` / `legal_document`. May carry `cnes_code`, `unit_type_id` / `unit_subtype_id` (CNES TP_UNIDADE catalogs), and other CRM fields.
- **Person** — one external human (`persons`): identity (`first_name`, `last_name`, `cpf`, phones, email, …). Soft-delete via `deleted_at`.
- **Healthcare profile** — optional `person_healthcare_profiles` (e.g. CNES professional id) + specialties M2M + professional registrations (CRM triple).
- **Affiliation** — `person_facilities` (active when `ended_at` is null). Classifications via `person_facility_classification_assignments` → catalog `id` + stable `code` (`HEALTHCARE_PROFESSIONAL` / `ADMINISTRATIVE_CONTACT`, seeded). Roles via `person_facility_role_assignments` → admin-dynamic role catalog `id` + `name` (no machine `code`, no migration seed). Wire DTOs use `roleIds` / `classificationIds`.
- **Person notes** / **facility notes** — private per-user notes (`person_notes`, `facility_notes`).
- **User–person relationships** — private 1–10 relationship strength (`user_person_relationships`).
- **Occupations** — CNES CBO catalog (`occupations`: `id` + `cnes_id` + `name`); affiliation occupations in `person_facility_occupations`.
- **Field suggestions** — user-submitted Não Conformidades (`field_suggestions`, `person_id` when person-scoped).

### Facility legal document types

| `legalDocumentType` | Document | Meaning |
|---|---|---|
| `CNPJ` | 14 digits | Pessoa Jurídica — legal entity (clinic, hospital, lab) |
| `CPF` | 11 digits | Pessoa Física — individual practitioner operating as a service point |

## API surfaces (as-built)

Facility-scoped projections (CASL `PERSON` + facility scope):

| Method | Path |
|---|---|
| GET/POST | `/api/v1/facilities/:facilityId/healthcare-professionals` (DTO includes `primaryRegistrationDisplay`) |
| GET/PATCH | `/api/v1/facilities/:facilityId/healthcare-professionals/:personFacilityId` |
| PUT | `/api/v1/facilities/:facilityId/healthcare-professionals/:personFacilityId/roles` |
| GET/POST | `/api/v1/facilities/:facilityId/administrative-contacts` |
| GET/PATCH | `/api/v1/facilities/:facilityId/administrative-contacts/:personFacilityId` |
| PUT | `/api/v1/facilities/:facilityId/administrative-contacts/:personFacilityId/roles` |

Person-scoped:

| Method | Path |
|---|---|
| GET/PATCH | `/api/v1/persons/:personId` (GET embeds active `registrations[]`) |
| GET/POST | `/api/v1/persons/:personId/notes` |
| GET + PUT/PATCH | `/api/v1/persons/:personId/relationship` |
| GET/POST | `/api/v1/persons/:personId/professional-registrations` |
| PATCH/DELETE | `/api/v1/persons/:personId/professional-registrations/:registrationId` (DELETE = soft deactivate) |
| GET | `/api/v1/person-professional-registration-councils` (`{ id, name, abbreviation }`) |
| GET | `/api/v1/healthcare-professionals` (Explorar / Meili) |
| GET | `/api/v1/healthcare-professionals/specialties` |
| GET | `/api/v1/person-facility-roles` (dynamic role catalog `{ id, name, isActive }`) |

Do not call removed registry endpoints (`/registry/*`) or deleted `/api/v1/professionals/*`.

## Frontend surfaces (current)

- **Web:** out of scope for person/professional CRM surfaces on this line of work (no rewire planned).
- **Mobile:** Explore + establishment detail — Médicos via healthcare projection (associate existing only; no in-app create-doctor); administrativos via administrative-contacts projection; doctor detail/notes/relationship/roles/registrations on person paths. See Spec 0005.

## Recurring Purchase Profile and Funnel

Facilities have a materialized recurring purchase profile used by the API and the Flutter **Explore** list and facility detail. The web facility UI does not expose this feature. [ADR 0002](../adr/0002-mobile-stack.md) remains **Proposed**, so the current production-facing mobile implementation is still Flutter.

### Vocabulary and rules

- **Purchase Recurrence:** the facility's repeat-purchase pattern derived from eligible order dates plus any manual profile.
- **Observed Purchase Interval:** the rounded arithmetic mean, in days, of up to 12 gaps formed by the 13 most recent distinct eligible UTC purchase dates. It is unavailable with fewer than two dates.
- **Effective Purchase Interval:** the interval that drives the funnel. It is the manual interval when overridden, the observed interval when calculable, or the 30-day default.
- **Purchase Profile:** the effective-interval mode. `AUTOMATIC` is the API/filter vocabulary for no manual override. Manual profiles are `WEEKLY` (7), `BIWEEKLY` (15), `MONTHLY` (30), `BIMONTHLY` (60), `QUARTERLY` (90), `SEMIANNUAL` (180), `ANNUAL` (365), and `CUSTOM` (integer from 1 to 3,650 days).
- **Purchase Funnel Stage:** the current timing stage: `NEVER_PURCHASED` (“Nunca comprou”), `OUTSIDE_WINDOW` (“Fora do período”), `PURCHASE_WINDOW` (“Período de compra”), `CHURN` (“Churn”), or `INACTIVE` (“Inativo”).

Eligible purchases are orders with status `APPROVED` or `INVOICED` and type `SALE` or `CONSIGNMENT`. `ordered_at` is converted to a UTC civil date (`YYYY-MM-DD`), and multiple eligible orders on the same facility/date count once.

For effective interval `d`, the funnel is:

```text
no eligible purchase             -> NEVER_PURCHASED
age < ceil(0.5 × d)              -> OUTSIDE_WINDOW
age < 2 × d                      -> PURCHASE_WINDOW
age < 3 × d                      -> CHURN
otherwise                        -> INACTIVE
```

Boundary dates enter the stage that starts on that date. The observed interval keeps recalculating under a manual override. Selecting `AUTOMATIC` removes the override and restores `CALCULATED` when an observed interval exists or `DEFAULT` with 30 days otherwise.

`facilities.purchase_status` is unchanged and distinct: it represents purchase intensity (`NON_BUYER`, `LOW_BUYER`, `REGULAR_BUYER`, `HIGH_BUYER`), not recurrence, profile, or timing stage.

### API and Flutter behavior

`GET /facilities` and `GET /facilities/:id` return `purchaseRecurrence` with `observedIntervalDays`, effective `intervalDays`, `source` (`DEFAULT`, `CALCULATED`, or `MANUAL`), manual `profile` or `null`, `lastPurchaseDate`, interval `sampleSize`, `funnelStage`, and `nextTransitionDate`.

`GET /facilities` supports comma-separated `purchaseFunnelStage`, `purchaseProfile` (including `AUTOMATIC`), `purchaseIntervalMinDays`, `purchaseIntervalMaxDays`, and server-side sort by `purchaseFunnelStage`, `purchaseIntervalDays`, or `lastPurchaseDate`. Text search applies the same filters and ordering in Meilisearch before pagination.

`PATCH /facilities/:id` accepts one recurrence command:

```json
{ "purchaseRecurrence": { "mode": "AUTOMATIC" } }
{ "purchaseRecurrence": { "mode": "PRESET", "profile": "MONTHLY" } }
{ "purchaseRecurrence": { "mode": "CUSTOM", "intervalDays": 45 } }
```

The scoped API update recalculates the snapshot immediately. Flutter Explore shows the stage, interval, last purchase, filters, and server-side sorts. Facility detail shows stage, profile, source, effective and observed intervals, sample size, last purchase, and next transition, and provides the authorized profile editor. After save, detail refreshes and Explore is updated; if only the list refresh fails, Flutter warns “Perfil salvo, mas a lista não pôde ser atualizada agora.” A `403` edit failure is shown as a permission error.

### Operations

Apply generated database migrations with the normal repository command:

```sh
DATABASE_URL="$DATABASE_URL" bun run db:migrate
```

Provision or update the stable hourly Temporal schedule after the worker is deployed:

```sh
bun run --cwd apps/workers/temporal schedule:purchase-recurrence
```

The schedule runs `RECONCILE` at minute zero each hour with overlap policy `SKIP`. It reads an overlapping two-hour order-update window and due stage transitions. The `00:00 UTC` run additionally performs a complete active-facility sweep. The freshness objective is the next successful hourly reconciliation for external order changes and UTC date transitions.

Emultec avulsa → CRM orders (whitelist products, seller/facility gates): see [`docs/ops/emultec-order-import.md`](../../ops/emultec-order-import.md). After worker deploy with Emultec env + Docker:

```sh
bun run --cwd apps/workers/temporal schedule:emultec-order-import
```

Manual / ops trigger (ADMIN `SEARCH_SYNC`):

```http
POST /sync
{ "entity": "emultec-orders" }
```

Schedule runs every 10 minutes (`BUFFER_ONE` catch-up). Hard upsert failures go to `ops.emultec_order_import_dead_letters` and are replayed on the next HYBRID.

Start the initial purchase-recurrence backfill through the authorized endpoint:

```http
POST /sync
Content-Type: application/json
Authorization: Bearer $ATLASMED_TOKEN

{ "entity": "orders" }
```

The returned stable workflow ID is `purchase-recurrence-backfill`; a repeated request while it is running returns that same execution. Inspect it with `GET /sync/purchase-recurrence-backfill`. The backfill is resumable through `continueAsNew`, emits lifecycle counters/logs, and finishes by rebuilding the facilities search index.

For an explicit full search repair, call the same authorized endpoint:

```http
POST /sync
Content-Type: application/json
Authorization: Bearer $ATLASMED_TOKEN

{ "entity": "facilities" }
```

The returned workflow ID is normally `search-sync-facilities-full`; inspect it with `GET /sync/:workflowId`. The rebuild uses a temporary index and atomic swap. Person Explorar index uid is `persons`; full rebuild via `POST /sync` with `{"entity": "persons"}` (same authorized sync surface; `SearchSyncEntity` includes `facilities` | `persons` | `orders`).

Use this aggregate to compare distributions before and after backfill or a rebuild:

```sql
SELECT purchase_interval_source, purchase_funnel_stage, count(*)
FROM facilities
WHERE deactivated_at IS NULL
GROUP BY 1, 2
ORDER BY 1, 2;
```

Diagnose overdue or failed recalculation candidates with:

```sql
SELECT
  id,
  purchase_interval_source,
  purchase_funnel_stage,
  next_purchase_funnel_transition_date,
  purchase_recurrence_calculated_at,
  updated_at
FROM facilities
WHERE deactivated_at IS NULL
  AND (
    purchase_recurrence_calculated_at IS NULL
    OR next_purchase_funnel_transition_date <= (now() AT TIME ZONE 'UTC')::date
  )
ORDER BY purchase_recurrence_calculated_at NULLS FIRST, id;
```

A nonzero due-transition result after a successful hourly workflow indicates SQL snapshot drift or a stalled batch. SQL remains authoritative; compare the returned facility IDs with Meilisearch results, inspect `facility_purchase_recurrence.*` lifecycle/error logs, rerun reconciliation if appropriate, and use the full facilities rebuild to repair search-only drift.

For the architectural rationale, lifecycle, consistency model, concurrency, and rollback risks, see [ADR 0003](../adr/0003-materialized-facility-purchase-funnel.md).

## Related specs

- Spec 0002 — Facility and Professional CRM requirements (baseline; table names historically pre-person).
- Spec 0005 — Mobile establishment detail (Médicos / administrativos UX).
- Spec 0007 — Não Conformidades (`field_suggestions`).
- ADR 0004 — Person + facility affiliation model.
