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

`ops.reconcile_watermark`, row `name = 'purchase_recurrence'`. The metric
snapshot reconciler keeps its own row in the same table.

`covered_until` advances only after a run **completes**, so a failed or
abandoned window is re-covered rather than stepped over. It never moves
backwards. If it falls more than 24 hours behind, the next run escalates to a
full sweep instead of widening the window.

```sql
select name, covered_until, now() - covered_until as behind
from ops.reconcile_watermark;
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

### Adding a filterable attribute: the cutover

`purchaseIntervalDaysMax`, `purchaseIntervalSourcesAny` and
`manualPurchaseProfilesAny` (2026-08-15) do not exist on documents written by
older code, and a Meili filter on a field a document lacks does not match it.

The dangerous state is not "no document has the field" — that returns nothing,
the API reports `empty_hits` and falls back to SQL, and results stay correct.
It is the **mixed** state. Once a reconcile or a facility edit republishes part
of the index in the new shape, a filter matches only the republished subset:
non-empty, so no fallback fires, and the rest of the clinics silently drop out.
That is the same failure this release fixes, reintroduced for the length of the
window.

The rebuild is blue/green — it fills a temporary index and swaps — so the live
index is either wholly old or wholly new. Keep it that way by not writing to it
in between:

```bash
# 1. no scheduled writer running or about to run
temporal schedule pause --schedule-id facility-purchase-recurrence-hourly
temporal schedule pause --schedule-id facility-purchase-recurrence-daily-sweep
# 2. terminate anything in flight (see the deploy section below)
# 3. deploy the worker and API
# 4. rebuild, and wait for the swap
curl -XPOST "$API/sync" -H 'content-type: application/json' -d '{"entity":"facilities"}'
# 5. resume
temporal schedule unpause --schedule-id facility-purchase-recurrence-hourly
temporal schedule unpause --schedule-id facility-purchase-recurrence-daily-sweep
```

A facility edited through the API during the window still republishes early;
that is a handful of clinics and the rebuild corrects them. Skipping the pause
entirely is survivable — exposure is at most one hour, on the interval and
purchase-profile filters only — but it is exactly the silent kind, so pause.

## Deploying a change to these workflows

**Terminate any in-flight execution before the new worker picks it up.** This is
not optional and it fails in the worst way if skipped.

A workflow whose code changed shape — a new activity call, a call in a different
order — cannot replay against a history written by the old code. The new worker
raises a non-determinism error, the workflow task retries forever, and the
execution stays **Running**. Overlap policy is `SKIP`, so every subsequent firing
is skipped: the funnel silently stops updating and nothing errors at the schedule
level. The watermark is what makes it visible, not the schedule.

```bash
for id in facility-purchase-recurrence-hourly \
          facility-purchase-recurrence-daily-sweep \
          facility-metric-snapshot-hourly \
          facility-metric-snapshot-nightly; do
  temporal workflow terminate --workflow-id "$id" --reason "worker deploy" || true
done
```

Safe to terminate at any point: nothing is lost. The watermark only advances on
completion, so the terminated window is re-covered by the next firing, and the
recalculation itself is idempotent.

Check for a stuck run:

```bash
temporal workflow list --query \
  "WorkflowType='purchaseRecurrenceWorkflow' AND ExecutionStatus='Running'"
```

An hourly execution still Running well into the next hour is either a genuinely
slow sweep or a workflow task failing on replay. `temporal workflow describe`
distinguishes them — a replay failure shows repeated `WorkflowTaskFailed` with no
activity progress.

## Log events

| event | meaning |
|---|---|
| `facility_purchase_recurrence.window_planned` | the window a run claimed, and whether it escalated to a sweep |
| `facility_metric_snapshot.window_planned` / `.window_committed` | the same pair for the metric-snapshot reconciler, which shares the table |
| `facility_purchase_recurrence.window_committed` | the watermark advanced — a run finished |
| `facility_purchase_recurrence.reconcile_batch_completed` | one page |
| `facility_purchase_recurrence.batch_failed` | page failed; retryable, cursor does not advance |
| `facility_purchase_recurrence.search_publication_failed` | DB committed, Meili did not — repaired by republish on retry |
| `emultec_order_import.profile_snapshot_invalidated` | an order changed clinics; the old profile was marked for recalculation |

A run that logs `window_planned` and never `window_committed` did not finish, and
its window will be re-covered.

Only a run that **claimed** its own window commits one. The child the Emultec
import starts arrives with an explicit `since`/`until` — and an `until` six hours
in the future — so it recalculates but does not touch the watermark. Committing
that would park the watermark ahead of anything actually covered.

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
