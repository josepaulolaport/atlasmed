# Purchase recurrence funnel — operations

The funnel is **materialized**, not computed on read. `purchase_funnel_stage`,
`purchase_interval_days`, `last_valid_purchase_date` and friends live on
`facility_vertical_profiles` and only change when something recalculates them.
Rules live in `@atlasmed/facility-insights`; ADR
[0003](../architecture/adr/0003-materialized-facility-purchase-funnel.md) is the
decision record.

## What feeds it

An order counts only if **all** of these hold:

| | |
|---|---|
| `orders.status` | `APPROVED` or `INVOICED` |
| `orders.type` | `SALE` or `CONSIGNMENT` |
| `facility_vertical_profiles.is_active` | `true` |
| `facilities.deactivated_at` | `NULL` |

Orders key on `facility_vertical_profile_id`, not on the facility (spec 0010
§4). A clinic with no active profile has nothing to recalculate.

`ordered_at` is bucketed to a **São Paulo** civil day, and same-day orders are
one purchase occasion. The observed interval is the **median** of up to twelve
gaps between the thirteen most recent purchase days.

## Schedules

Two, both overlap `SKIP`, both provisioned by
`ensure-purchase-recurrence-schedule.ts` on worker boot.

| schedule id | when | what |
|---|---|---|
| `facility-purchase-recurrence-hourly` | minute 0 of every hour | incremental reconcile |
| `facility-purchase-recurrence-daily-sweep` | 06:30 UTC (03:30 BRT) | full active-facility sweep |

They are separate ids deliberately. When the sweep was a branch inside the
hourly run, an hourly run overrunning past midnight caused the midnight firing
to be skipped and took the daily repair with it.

`facility-purchase-recurrence-nightly-repair` is legacy and is deleted on boot.

## What the hourly run picks up

Three selectors, unioned and keyset-paged:

1. facilities whose orders changed since the watermark;
2. facilities whose `next_purchase_funnel_transition_date` is due;
3. facilities with an **invalidated snapshot** — `purchase_recurrence_calculated_at IS NULL`.

(3) is how a clinic that *lost* an order gets recalculated. Nothing joins to it
through `orders` any more, so no other selector can reach it. The Emultec
importer clears the timestamp on the profile an order moved away from.

## The watermark

`ops.purchase_recurrence_watermark` — one row, `id = 1`.

`covered_until` advances only after a run **completes**, so a failed or
abandoned window is re-covered rather than stepped over. It never moves
backwards. If it falls more than 24 hours behind, the next run escalates to a
full sweep instead of widening the window.

```sql
select covered_until, now() - covered_until as behind
from ops.purchase_recurrence_watermark;
```

More than a couple of hours behind means the hourly reconcile is not completing.
Check for a stuck workflow before touching the schedule.

## Backfill

Started explicitly, never on a schedule:

```bash
curl -XPOST "$API/sync" -H 'content-type: application/json' -d '{"entity":"orders"}'
```

Stable workflow id `purchase-recurrence-backfill`. It keyset-pages every active
facility, continues as new every 10,000 records, and runs one full facilities
search rebuild at the end.

## Meilisearch

SQL is authoritative; the index is a projection. The worker publishes with
`addDocuments`, which **replaces** a document rather than merging into it — so
every writer of the `facilities` index must populate the full column list.
That list is `FACILITY_DOCUMENT_COLUMNS` in `search/rebuild.ts` and is shared;
do not re-select those columns locally.

A field missing from a document does not error. The clinic just stops matching
filters on it, and the API only falls back to SQL when Meili returns *nothing* —
so partial loss is invisible. `rebuild.test.ts` guards the column list.

**After deploying the 2026-08-15 change, run a full facilities rebuild.**
`purchaseIntervalDaysMax`, `purchaseIntervalSourcesAny` and
`manualPurchaseProfilesAny` are absent from existing documents, and the interval
and profile filters will under-match until they exist.

```bash
curl -XPOST "$API/sync" -H 'content-type: application/json' -d '{"entity":"facilities"}'
```

## Log events

| event | meaning |
|---|---|
| `facility_purchase_recurrence.window_planned` | the window a run claimed, and whether it escalated to a sweep |
| `facility_purchase_recurrence.window_committed` | the watermark advanced — a run finished |
| `facility_purchase_recurrence.reconcile_batch_completed` | one page |
| `facility_purchase_recurrence.batch_failed` | page failed; retryable, cursor does not advance |
| `facility_purchase_recurrence.search_publication_failed` | DB committed, Meili did not — repaired by republish on retry |
| `emultec_order_import.profile_snapshot_invalidated` | an order changed clinics; the old profile was marked for recalculation |

A run that logs `window_planned` and never `window_committed` did not finish, and
its window will be re-covered.

## Diagnostics

Profiles whose snapshot is pending recalculation — expected to be near zero
between runs, and to drain within the hour:

```sql
select count(*) from facility_vertical_profiles p
join facilities f on f.id = p.facility_id
where p.is_active and f.deactivated_at is null
  and p.purchase_recurrence_calculated_at is null;
```

Staleness distribution:

```sql
select date_trunc('hour', purchase_recurrence_calculated_at) as calculated,
       count(*)
from facility_vertical_profiles
where is_active
group by 1 order by 1 desc limit 24;
```

## Known gap

Nothing in this repository deletes an order. One removed **upstream in Emultec**
is not detected — the importer only reads forward — and the clinic keeps that
purchase until the daily sweep recomputes it from what is actually in `orders`.
Bounded at 24 hours. Detecting upstream deletion would mean diffing our
`id_avulsa_emultec` set against Emultec's per window, where a transient upstream
failure would read as a mass deletion; that is deliberately not done.
