# Feature: Facility and Professional CRM

## Current State

AtlasMed has clinic and doctor CRM support: facility records, professional records, facility–professional associations, facility representatives (administrative contacts), notes, relationship scores, Meilisearch indexes, and purchase-recurrence snapshots. CNES registry warehouse ingest and `/registry/*` READ/confirm are **removed**.

User-submitted field corrections and deactivation requests use `public.field_suggestions` (Não Conformidades) — see Spec 0007. That path is not a CNES registry suggestion queue.

## Current Data Concepts

- **Facility** — Pessoa Jurídica (CNPJ) or Pessoa Física (CPF), discriminated by `taxIdType`. May carry `cnes_code` and other CRM fields.
- **Professional** — healthcare person record (`professionals`): identity fields plus optional CRM / CNES professional identifiers and primary specialty label.
- **Facility–professional association** — `facility_professionals` (occupation code, commercial flags such as prescriber/buyer/decision-maker/partner, confirmation and end lifecycle).
- **Facility representative** — `facility_representatives`: administrative/commercial contact stored **per facility** with its own name/contact fields and role flags (administrator, buyer, decision-maker, partner, biller, secretary). Not the same table as `professionals`.
- **Professional notes** / **facility notes** — private per-user notes.
- **User–professional / user–representative relationships** — private 1–10 relationship strength scores.
- **Occupations** — public CNES CBO lookup catalog (`occupations`).
- **Field suggestions** — user-submitted Não Conformidades (`field_suggestions`).

### Facility types

| `taxIdType` | Tax ID | Meaning |
|---|---|---|
| `PJ` | CNPJ | Pessoa Jurídica — legal entity (clinic, hospital, lab) |
| `PF` | CPF | Pessoa Física — individual practitioner operating as a service point |

## Frontend surfaces (current)

- **Web:** facilities, professionals, facility detail (including professionals / representatives where implemented).
- **Mobile:** Explore + establishment detail — Médicos from CRM `facility_professionals` + `professionals`; Profissionais administrativos from `facility_representatives`. See Spec 0005.

Do not call removed registry endpoints (`/registry/*`, `/facilities/:id/registry/*`).

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

## Related specs

- Spec 0002 — Facility and Professional CRM requirements (baseline).
- Spec 0005 — Mobile establishment detail (Médicos / administrativos UX).
- Spec 0007 — Não Conformidades (`field_suggestions`).
