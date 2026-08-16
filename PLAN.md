# Plan: CNES ingestion pipeline remediation

Context: on 2026-08-14 the CNES ingestion completed in production for the first
time — competência 2026-07 — after five failed runs and four distinct bugs. The
final steps were finished by a one-off script rather than by the loader. This
plan makes the pipeline finish on its own next month.

Deadline is **2026-08** (the next competência). 2026-07 is loaded and the ledger
records it COMPLETED, so the weekly schedule will return `SKIPPED: already
loaded` until then.

## What we agreed

| Decision | Resolution |
|---|---|
| Surviving worker restarts | **All three**: per-phase activities, a dedicated CNES worker on its own task queue, and raise `maximumAttempts`. They address three different failure paths and compose. |
| Set-based SQL port | **All post-staging derivations** — registrations, vínculos, occupation links, person bridge. Proven against production tonight: 21 seconds for work the loader could not finish in four hours. |
| Atomicity | Wrap those derivations in **one transaction**, so the roster is never observable half-replaced. Measured at ~21s, so the lock is short. |
| Verification | **Migrate the existing local test database** to current schema and run the loader's db tests for real before each PR. |
| Peripheral fixes | All four in scope: purchase `heartbeatTimeout`, the broken manual deploy workflow, the Temporal UI outage, and consolidating the Postgres error helpers. |

### Why each resilience change

Three runs died today to worker restarts, not to code:

- **Per-phase activities** — the whole load is currently one activity, so any
  restart re-climbs from the archive. Temporal records completed activities in
  workflow history, so splitting phases makes a restart resume at the failed
  phase.
- **Dedicated worker + queue** — every merge to `main` auto-deploys and restarts
  the shared worker. An independently deployed CNES worker is untouched by app
  merges. (This is what the `atlasmed-cnes-worker` removed today was doing, on
  code that no longer exists on `main`.)
- **`maximumAttempts`** — currently 2, so two restarts end a run permanently.

## Task breakdown

### 1. Commit the registrations batching fix
`packages/cnes-ingestion/src/load/load-registry.ts`

Already written on `fix/cnes-batch-registrations-20260814`, uncommitted. Adds
in-memory keep-first dedup on `(council, UF, number)` and rewrites the batch
insert with `where not exists` so a held identity cannot abort the statement.
Removes the per-row fallback storm that measured 8 rows/s against 125,724 rows.

Superseded in part by Task 3, but lands first as the small, reviewable fix.

### 2. Migrate the local test database
`packages/database/scripts/migrate.ts` (run, not modified), local `atlasmed_test`

Bring the local database to current schema so `load-registry.db.test.ts` runs.
Today 20 of its 21 tests fail on unmodified `main` from schema drift, which is
why every loader change today was verified by reading rather than running.

### 3. Port post-staging derivations to set-based SQL
`packages/cnes-ingestion/src/load/load-registry.ts`

Replace steps 5–7 with the statements proven in production tonight:
registrations (double `distinct on` — identity *and* conflict target — plus
`where not exists`), vínculos, occupation links, and the person bridge. Wrap all
four in one transaction. Reference implementation:
`scratchpad/finish-cnes-202607.ts`.

Keep the loader's counters (`registrationsConflicted`, `occupationsUnmapped`)
populated from row counts so the log still reports what was skipped.

### 4. Split the load into per-phase activities
`apps/workers/temporal/src/workflows/cnes-ingestion.workflow.ts`,
`apps/workers/temporal/src/activities/cnes-ingestion.activities.ts`,
`packages/cnes-ingestion/src/load/load-registry.ts`

Break `ingestCnesRegistryActivity` into one activity per phase — establishments,
subtypes, staging, derivations, promote. Each needs its own entry point into the
loader, which today is one monolithic `loadRegistryFromCsv`.

Raise `maximumAttempts` from 2 to 5 on the load activities.

### 5. Dedicated CNES worker and task queue
`deploy/uncloud.compose.yml`, `apps/workers/temporal/src/worker.ts`,
`apps/workers/temporal/src/scripts/ensure-cnes-ingestion-schedule.ts`,
`.github/workflows/deploy-services-to-cluster.yml`

Run the CNES workflow and activities on their own worker and task queue,
deployed independently of the shared worker, so app merges do not restart a
running load. Point `cnes-ingestion-weekly` at the new queue.

### 6. Purchase recurrence heartbeat
`apps/workers/temporal/src/workflows/purchase-recurrence.workflow.ts`

Add `heartbeatTimeout` to `PURCHASE_RECURRENCE_ACTIVITY_OPTIONS` and heartbeat
from the batch loop. Today a dead worker left the activity hanging for the full
30-minute `startToCloseTimeout` instead of being detected in seconds.

### 7. Consolidate the Postgres error helpers
`apps/api/src/shared/utils/postgres-unique-violation.ts` → shared package,
`packages/cnes-ingestion/src/load/load-registry.ts`

`isPostgresUniqueViolation` already walks the cause chain and checks
`constraint`/`detail`; the loader independently grew its own walker checking
`constraint_name`. One shared helper covering all three field names would have
prevented tonight's bug, where the loader read `code` off a wrapped
`DrizzleQueryError` and got `undefined`.

### 8. Fix the manual deploy workflow
`.github/workflows/deploy-temporal-worker-manual.yml`

Fails with `exec /bin/sh: exec format error` — an amd64 runner building an arm64
image. The auto-deploy works because it uses `docker/setup-qemu-action`; the
manual one does not. Add it, or delete the workflow so nobody reaches for it.

### 9. Restore the Temporal UI
`deploy/caddy.global.Caddyfile`, `deploy/uncloud.compose.yml`

Both hostnames fail TLS at the origin (`HTTP 525` on `temporal-ui.tdomains.uk`,
connection failure on the `uncld.dev` host). No web view of workflow history is
why today was spent reading heartbeats through the CLI.

### 10. Verify the association screen
`apps/mobile/lib/features/explore/presentation/widgets/clinic_detail/associate_doctors_sheet.dart`

Confirm CNES suggestions and the competência now appear. The competence resolves
from the newest `COMPLETED` run with `promoted_at`, falling back to the newest
staged competência; **both were null until tonight**, and
`registry.facility_professionals` held 0 rows. Both are now populated
(2026-07, 142,033 vínculos), so this may need no code change — check before
assuming a bug.

## Blocking relationships

- Task 3 blocked by Task 2 — porting the derivations without runnable db tests
  repeats today's mistake of shipping read-verified code.
- Task 4 blocked by Task 3 — splitting phases is cleaner once the derivations
  are single statements rather than JS loops.
- Task 5 blocked by Task 4 — the queue split is simpler once phases are discrete
  activities.
- Task 1 can land immediately; it is independent and small.
- Tasks 6, 7, 8, 9, 10 are independent of everything and of each other.

## Deferred questions

- **COPY for the staging ingest.** Staging is ~17 minutes of a ~35-minute run,
  the largest remaining chunk. Not in scope; revisit if runtime still hurts after
  Tasks 3–5. Default if unresolved: leave the batched inserts.
- **Checkpointing within a phase.** Per-phase activities mean a restart loses at
  most one phase; staging is the longest at ~17 minutes. Default: accept losing a
  phase rather than build cursor persistence.
- **Rotating the Neon credential.** A `neondb_owner` connection string was pasted
  into the working session and used for tonight's writes. Not a code task, but it
  should be rotated. Default if unresolved: it stays valid.
- **`registrationsConflicted` semantics after Task 3.** The set-based path counts
  skipped rows rather than catching per-row exceptions, so the number will be
  derived differently. Default: keep the same meaning (rows not written because
  the identity is held by another SUS id).
