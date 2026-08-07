# ADR 0003: Materialize the Facility Purchase Recurrence Funnel

## Status

Accepted — **amended 2026-07-28**: funnel is per Linha comercial (`facility_vertical_profiles`), not facility-global. **Amended 2026-08-06**: `facilities` funnel rollup columns removed; Meilisearch uses per-vertical composite fields.

### Amendment (per-vertical materialization)

- Eligible orders are filtered by `(facility_id, vertical_id)`.
- Snapshot columns live on `facility_vertical_profiles` (same fields as originally on `facilities`).
- API list/detail expose top-level `purchaseRecurrence` from the matching profile(s): single profile or multi-profile **consensus**; when stages disagree, omit top-level and keep per-profile `verticalProfiles[].purchaseRecurrence`.
- Manual configure / PATCH requires `verticalId` when the clinic has more than one active profile.
- Worker backfill/reconcile recalculates every active profile for each facility, then publishes Meilisearch documents with per-vertical composite funnel fields (no facility rollup).

### Amendment (Meilisearch per-vertical composites)

- `facilities.*` funnel rollup columns are **removed**; the purchase-recurrence worker no longer writes them.
- Facility search documents derive funnel filter/sort fields from active `facility_vertical_profiles`: `verticalFunnelStages`, `verticalPurchaseIntervalSources`, `verticalManualPurchaseProfiles`, plus facility-level aggregates (`purchaseFunnelStagesAny`, `purchaseFunnelStageRank`, `purchaseIntervalDaysMin`, `hasLastValidPurchase`, `lastValidPurchaseSortAt`).

## Context

Facility exploration needs server-side filtering and deterministic ordering by purchase timing, both for PostgreSQL-backed lists and Meilisearch-backed text search. Calculating recurrence and funnel stage while serving each page would repeatedly aggregate order history, make pagination expensive, and make SQL and Meilisearch results difficult to align.

The repository also does not yet own every order writer. An event-only projection therefore cannot guarantee that changes to historical or externally written orders reach the facility read model. Funnel stage also changes as UTC civil dates advance even when no order event occurs.

## Decision

Materialize the current purchase recurrence snapshot on `facilities` and maintain it through the shared deterministic rule in `@atlasmed/facility-insights`, immediate API recalculation for manual configuration, and an idempotent Temporal lifecycle for backfill and repair.

### Source of truth

- Eligible rows in `orders` are the source of truth for observed purchase history. Only status `APPROVED` or `INVOICED` and type `SALE` or `CONSIGNMENT` are eligible.
- `orders.ordered_at` is normalized to a UTC civil date (`YYYY-MM-DD`). Multiple eligible orders for the same facility on the same UTC date are one purchase occasion.
- The 13 most recent distinct purchase dates produce at most 12 intervals. Their arithmetic mean, rounded to the nearest integer, is the **Observed Purchase Interval**. Fewer than two dates produce `null`.
- Manual configuration on `facilities` is the source of truth for an override. It does not replace or stop recalculation of the observed interval.
- `@atlasmed/facility-insights` is the source of truth for interval and stage rules. PostgreSQL stores the materialized result; Meilisearch is a derived search projection, not an independent business source.

### Effective interval and profiles

The **Effective Purchase Interval** (`purchase_interval_days`) drives the funnel:

- no manual profile and no observed interval: 30 days, source `DEFAULT`;
- no manual profile with enough history: observed interval, source `CALCULATED`;
- manual preset or custom profile: configured interval, source `MANUAL`.

Manual presets are `WEEKLY=7`, `BIWEEKLY=15`, `MONTHLY=30`, `BIMONTHLY=60`, `QUARTERLY=90`, `SEMIANNUAL=180`, and `ANNUAL=365`. `CUSTOM` accepts an integer from 1 through 3,650 days. Choosing `AUTOMATIC` through the API clears the manual override and returns to `CALCULATED` or `DEFAULT` without discarding the observed interval.

`purchase_status` remains a separate commercial-intensity classification (`NON_BUYER`, `LOW_BUYER`, `REGULAR_BUYER`, `HIGH_BUYER`). It is not a recurrence profile or funnel stage.

### Funnel stages

For effective interval `d`, last eligible UTC purchase date `last`, and current UTC civil date `today`:

```text
no last purchase                 -> NEVER_PURCHASED
age < ceil(0.5 × d)              -> OUTSIDE_WINDOW
age < 2 × d                      -> PURCHASE_WINDOW
age < 3 × d                      -> CHURN
otherwise                        -> INACTIVE
```

A boundary date belongs to the stage that starts on that date. `next_purchase_funnel_transition_date` is materialized for `OUTSIDE_WINDOW`, `PURCHASE_WINDOW`, and `CHURN`; it is `null` for `NEVER_PURCHASED` and `INACTIVE`.

### Materialized fields

The facility read model stores funnel snapshots on `facility_vertical_profiles` only (rollup columns on `facilities` were removed):

- `observed_purchase_interval_days`;
- `purchase_interval_days` and `purchase_interval_source`;
- `manual_purchase_profile` and `manual_purchase_interval_days`;
- `last_valid_purchase_date` and `purchase_recurrence_sample_size`;
- `purchase_funnel_stage` and `next_purchase_funnel_transition_date`;
- `purchase_recurrence_calculated_at`.

Database checks constrain intervals to 1–3,650 days, samples to 0–12 intervals, custom profile values, and consistency between a manual profile and source `MANUAL`. Partial indexes support active-facility stage/profile filters, interval ordering, and due-transition scans. The eligible-order index supports the 13-date lookup; the `(updated_at, facility_id)` index supports reconciliation.

Schema changes and SQL migrations are generated with Drizzle Kit and committed together. Historical calculation does not run inside the migration: safe defaults make existing facilities readable as 30-day `DEFAULT` / `NEVER_PURCHASED` until backfill.

### SQL and Meilisearch consistency

SQL and Meilisearch expose the same per-profile materialized stage, effective interval, source, manual profile, and last-purchase sort keys. SQL is authoritative. Worker batches recalculate PostgreSQL profiles first, then publish complete facility search documents with per-vertical composite funnel fields, including unchanged snapshots, so a retry can repair a prior search-publication failure. Meilisearch filtering happens before pagination, and business sorts use deterministic rank and tie-break fields equivalent to SQL.

A full facilities search rebuild uses the existing blue/green `search-sync-facilities-full` workflow. It is required after initial backfill and remains the repair mechanism for projection drift; it is not the primary update path.

### Temporal lifecycle and freshness objective

`purchaseRecurrenceWorkflow` supports:

- `BACKFILL`: keyset-pages all active facilities in batches of 500, continues as new after 10,000 processed records, and performs one full facilities search rebuild at completion;
- `RECONCILE`: hourly processing of facilities whose orders changed in an overlapping two-hour window and facilities whose next stage transition is due;
- midnight repair: the `00:00 UTC` reconciliation performs a full active-facility sweep, covering external writers that did not preserve `orders.updated_at` correctly.

The stable Temporal schedule runs at minute zero of every hour with overlap policy `SKIP`. The operational freshness objective is one successful hourly reconciliation cycle: externally written order changes and clock-driven stage transitions should be reflected by the next completed hourly run. The midnight sweep may take longer than one cycle on a large data set and is the completeness repair, not the normal freshness path.

The initial `BACKFILL` is started explicitly through `POST /sync` with `{ "entity": "orders" }`, which starts `purchaseRecurrenceWorkflow` with `{ "mode": "BACKFILL" }` under the stable `purchase-recurrence-backfill` workflow ID; it is not part of schedule provisioning.

### Concurrency and future writer hook

Both the API override path and worker recalculation lock the facility row with `SELECT ... FOR UPDATE`, then re-read manual configuration and eligible purchase dates and persist the complete snapshot in one transaction. This prevents a reconciliation from losing a concurrent manual override.

When an order writer/importer is added to this repository, its post-commit hook must enqueue recalculation for changes to `facility_id`, `ordered_at`, `status`, or `type`, and for deletion. If the facility changes, both the old and new facility IDs must be recalculated. This hook improves freshness but does not replace hourly reconciliation and midnight repair.

## Alternatives

### Aggregate at query time

Rejected. It avoids stale snapshots but repeats distinct-date aggregation and interval calculations for every list request, makes indexed filtering and stable pagination expensive, and cannot provide an equivalent Meilisearch projection without materializing the same information elsewhere.

### Event-only projection

Rejected as the sole mechanism. It could provide lower latency once all order writers publish reliable post-commit events, but current writers are not all owned here, historical edits and deletions may be missed, and civil-date stage transitions occur without an order event.

## Consequences

- Facility list and search reads are fast, filterable, sortable, and consistent in vocabulary across SQL, API, worker, and Flutter mobile.
- The read model is intentionally eventually consistent with external order writes and with the UTC clock, within the hourly freshness objective under healthy Temporal and Meilisearch operation.
- Immediate manual edits return a freshly calculated SQL/API snapshot; search-list refresh can still lag or fail independently and is repaired by reconciliation or rebuild.
- Recalculation is idempotent and retry-safe, but a database commit can precede a failed Meilisearch publication. Republish-on-retry and full rebuild are required repair paths.
- Row locks serialize changes per facility. Very large facilities or slow order queries can increase lock time; the eligible-order index and 13-date limit bound the critical query.
- `SKIP` prevents overlapping scheduled runs, but a reconciliation that regularly exceeds one hour violates the freshness objective and must be investigated before increasing concurrency or changing the schedule.
- Rollout order is generated migration, compatible API/worker deployment, schedule provisioning, initial backfill, aggregate/drift checks, and facilities search rebuild.
- Rollback must account for additive enum types and columns. Application rollback is safe only while older code tolerates the added fields; dropping populated columns/enums is destructive and requires a separately generated migration. Pause the schedule before a schema rollback, and retain order data so the snapshot can be rebuilt.
- Operational risks are missed external updates, stale clock transitions, SQL/Meilisearch drift, partial backfill, and lock contention. The overlapping hourly window, midnight sweep, lifecycle logs/counters, idempotent retries, diagnostic SQL, and blue/green rebuild are the corresponding controls.
