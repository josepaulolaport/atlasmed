# Feature: Facility, Professional, and Registry Ingestion

## Current State

Atlasmed has early clinic and doctor domain support, including clinic records, doctor records, facility-professional associations, and external registry ingestion workflows.

## Current Data Concepts

- Facility (Pessoa Jurídica / CNPJ or Pessoa Física / CPF — discriminated by `taxIdType` enum).
- Doctor (professional).
- Doctor-clinic association.
- Facility services (`facility_services`) — healthcare services offered by a facility, sourced from CNES `rlEstabServClass` and synced each ingestion cycle.
- Ingestion run.
- Ingestion suggestion.

### Facility types

A facility is typed by its tax registration:

| `taxIdType` | Tax ID | Meaning |
|---|---|---|
| `PJ` | CNPJ | Pessoa Jurídica — legal entity (clinic, hospital, lab) |
| `PF` | CPF | Pessoa Física — individual practitioner operating as a service point |

The type is derived from the CNES registry at ingestion time and backfilled on existing rows from whichever tax ID column is populated.

### Facility services

`facility_services` stores the service/specialty codes associated with a facility (CNES table `rlEstabServClass`). Columns: `serviceCode`, `classificationCode`, `sourceProvider`. Populated and kept in sync by the `syncFacilityServicesActivity` step in the CNES monthly ingestion workflow. Services are returned on `GET /facilities/:id` but not on the list endpoint.

## Recurring Purchase Profile and Funnel

Facilities have a materialized recurring purchase profile used by the API and the Flutter **Explore** list and facility detail. This is the implemented client surface; the web facility UI does not expose this feature. [ADR 0002](../adr/0002-mobile-stack.md) remains **Proposed**, so the current production-facing implementation is still in the existing Flutter app.

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
bun run --cwd apps/workers/cnes-ingestion schedule:purchase-recurrence
```

The schedule runs `RECONCILE` at minute zero each hour with overlap policy `SKIP`. It reads an overlapping two-hour order-update window and due stage transitions. The `00:00 UTC` run additionally performs a complete active-facility sweep. The freshness objective is the next successful hourly reconciliation for external order changes and UTC date transitions.

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

The returned workflow ID is normally `search-sync-facilities-full`; inspect it with `GET /sync/:workflowId`. The rebuild uses a temporary index and atomic swap.

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

## Registry Ingestion Suggestions

Current suggestion types include:

- Facility removal.
- Facility reactivation.
- Doctor-clinic association removal.

## Relationship to Calendar and Interactions

Facilities and professionals provide CRM context for commercial contacts, but contact does not imply physical presence. New scheduling and activity flows use the [Calendar and Commercial Interactions](calendar-interactions.md) domain.

An interaction is linked to a facility and may be `IN_PERSON` or `REMOTE`. Facility notes remain scoped to the facility–user relationship, and orders may optionally link to an interaction.

`visits` remains only as a compatibility ledger written when an interaction is completed. Registry and CRM documentation should not use visit as the generic term for every contact or follow-up.

## Target Direction

This domain should evolve into the healthcare CRM foundation. It should support profile quality, relationship and interaction history, territory-aware access, notes, follow-ups, data provenance, and governed workflows for accepting or rejecting external data changes.

## Open Questions

- Which external registries are authoritative per market?
- Which fields are user-editable versus registry-controlled?
- What data needs approval before becoming visible to field teams?
- How should clinic/doctor data be tenant-scoped when multiple customers share public registry sources?
