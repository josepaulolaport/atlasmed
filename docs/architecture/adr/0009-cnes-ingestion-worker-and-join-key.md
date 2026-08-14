# ADR 0009 — CNES ingestion worker, and the join key measured

**Status:** Accepted · **Date:** 2026-08-11
**Supersedes in part:** ADR 0006 (§ *In scope* "manual loading", § *Explicitly out of scope*
first two bullets, § *Consequences* the `cnes_professional_id` bullet). ADR 0006 required a new
ADR to widen its scope; this is that ADR.
**Relates:** Spec 0012, ADR 0004 § 8 (identity matching precedence)

## Context

ADR 0006 reintroduced a narrow `registry` schema and deliberately excluded the import pipeline:
loading would be manual, there would be no `ingestion` schema and no Temporal workflow. That was
the right call on the information available. Two things have changed since.

**The join key is not what the spec assumed.** ADR 0006 recorded, as an open consequence, that
`person_healthcare_profiles.cnes_professional_id` (unique text since `0076`) "is probably dead
weight", and spec 0012 § 4 planned a `(council, UF, número)` composite with normalised comparison
columns on both sides. Measured against the real 202605 export, that is backwards:

| | |
|---|---|
| our populated `cnes_professional_id` | 1190 of 1205 healthcare profiles (98.8 %) |
| found as `CO_PROFISSIONAL_SUS` in the export | **1190 of 1190 (100.0 %)** |
| export rows scanned | 7 761 583 |
| rows matching `^[0-9A-F]{16}$` | 7 761 583 (100.00 %) |

It is the same identifier, exactly, on every row. Both sides are already unique and indexed —
`registry.professionals.cnes_id` is the primary key, and
`person_healthcare_profiles_cnes_professional_id_uidx` is a partial unique on ours.

**Manual loading does not survive contact with the archive.** Reproducing that measurement
required locating an entry in a 725 MB remote ZIP, range-fetching it, and inflating it in one
pass. That is a worker's job, and doing it by hand monthly is how a pipeline rots.

## Decision

### 1. The professional join is one column

```sql
registry.professionals.cnes_id = person_healthcare_profiles.cnes_professional_id
```

No normalisation, no council translation, no composite. ADR 0004 § 8's precedence is unchanged in
spirit — this is the "verified `cnes_professional_id`" rung, promoted because it was measured
rather than assumed.

`(council, UF, número)` is retained as a **fallback** for people with no CNES id: 15 profiles
today, 7 of which carry a registration, leaving 8 unmatchable by any key. At 0.7 % that path is
phase two, not a launch blocker.

`registry.professional_registrations` continues to load — it feeds the fallback and the eventual
CFM import — but it is off the critical path.

### 2. A Temporal worker replaces the script

Self-provisioning schedule, following the pattern already in `apps/workers/temporal`, recording
into `ingestion.cnes_runs`.

**Daily tick for a monthly export.** DATASUS publishes on no fixed day, so a monthly trigger
either fires before the competence exists or waits weeks after it appears. The workflow lists the
directory, and returns `SKIPPED` when the newest competence is already loaded — which is what most
days are. A skip costs one FTP listing.

**The load is one activity, not one per phase.** The scan builds maps keyed by establishment and
SUS id that later steps consume; splitting phases across activities would serialise those through
Temporal's 4 MB payload limit. Phases are still written to `cnes_runs.phase` from inside the
activity, so an operator can see where a run is, and a `heartbeatTimeout` of two minutes is what
makes a killed worker recoverable without a generous start-to-close timeout.

### 3. `ingestion.cnes_runs` is in scope — that table only

ADR 0006 excluded the `ingestion` schema because the deleted pipeline carried `cnes_diffs` and
`cnes_suggestions` with twelve suggestion types and an approve surface. Those stay excluded. A run
ledger is not that: without it a failed monthly load is invisible, and "which competence is
loaded" has no answer.

### 4. The archive is never downloaded whole

The ZIP central directory gives every entry's offset and compressed size, and the DATASUS FTP
endpoint honours byte ranges. So the worker fetches **only the six entries it reads**, in
dependency order, ignoring their order in the file:

| | 202605 |
|---|---|
| archive | 725 163 445 B (109 entries) |
| uncompressed, whole | 2.87 GB |
| the six we read | 2.01 GB (~548 MB compressed) |
| largest single entry | `tbDadosProfissionalSus`, 322.7 MB → 907.2 MB |

Nothing is written to disk and nothing is staged in Postgres. Measured: the largest entry fetched,
inflated and parsed in 81 s.

**Retry granularity is one entry, not one range.** Deflate keeps no resumable mid-stream state, so
a connection lost part-way through an entry has to restart *that entry* — resuming at a byte
offset would require having inflated everything before it. Entries are independent, so a failure
costs one entry rather than the archive. The origin drops connections routinely, which is why this
is stated rather than assumed.

This replaces ADR 0006's "no FTP adapter" with something narrower than what was deleted — a
ranged reader, not an adapter with archive staging.

### 5. Scope is by registration, not by occupation

A carga row enters the registry when it carries a council registration, not when its CBO starts
with `225`. Identity comes from the registration; inferring "doctor" from an occupation code was
a proxy for it.

CBO is still captured, on `registry.facility_professional_occupations`, which already exists.

### 6. `registry.professional_councils` is seeded by hand, once

The loader reads the council whitelist **from that table** rather than from a constant, and
refuses to run if it is empty. The export ships two disagreeing council code systems and its
catalogue is unreliable; a manual seed is the only trustworthy source. The same seed fills
`atlasmed_id`, which is how a registry council resolves to one of ours.

### 7. Professionals are never deleted

Unchanged from ADR 0006, restated because the worker makes it load-bearing: absence from a month's
export is not evidence anyone left, and a delete would drop a bridge a user made by hand. Only
`source_last_seen_at` moves. The facility↔professional roster **is** replaced wholesale, per
facility we operate — scoped from `public`, so a clinic whose last doctor left is cleared rather
than skipped.

## Still out of scope

Archive storage · diff / suggestion tables · a suggestion review surface · `/registry/*` API
module · any write-back from `registry` to `public` · national-scale registry data.

ADR 0006's guard still applies: widening past this list needs another ADR.

## Consequences

**Positive**
- The join needs **no `public` migration**. Spec 0012's "likely zero changes to `public`" turns
  out to be right, by a different route than it expected.
- Coverage is 100 % of the people we hold a CNES id for, not an estimate.
- Disk cost of a monthly run is zero.

**Negative / accepted**
- A failed run re-fetches. There is no staged archive to retry against — the price of the disk
  constraint, made tolerable by per-range retry.
- The registry remains a point-in-time snapshot with no freshness signal in the UI (ADR 0006's
  accepted risk, unchanged). The run ledger now at least records *when*.
- Reintroducing a worker re-accepts operational weight ADR 0006 removed. The scope list above is
  the guard.
- Our own `registration_number` is not normalised: two rows carry a leading zero. Harmless while
  the primary key is the CNES id; it must be fixed before the fallback path ships, and that will
  need the `public` migration this ADR otherwise avoids.

**Neutral**
- ADR 0004 Q21 is still not violated. CNES suggests, a human confirms, every `person_facilities`
  row stays a manual act.

## Alternatives considered

**Keep manual loading.** Rejected — the measurement that produced this ADR was itself a
programme, and monthly hand-running is how the last pipeline decayed.

**Download and extract the archive.** Rejected — 2.87 GB extracted for 2.01 GB we read, on a host
with no room for it, when ranged fetch reads less and resumes better.

**Stream the archive sequentially.** Rejected — all 109 entries set the data-descriptor bit, so
local headers carry zero sizes and a sequential reader must inflate every entry to find the next.
It also fixes read order to file order, and `tbDadosProfissionalSus` precedes
`tbCargaHorariaSus`, which is the wrong way round for the scope filter.

**Build the `(council, UF, número)` composite as primary.** Rejected on measurement: it needs
generated columns on both sides, a council bridge, and zero-padding normalisation, to reach a
population the single hex column already covers completely.

## References

- ADR 0006 — the schema this widens
- ADR 0004 § 8 — identity matching precedence
- Spec 0012 §§ 3.2, 4, 9 — to be amended to match this decision
- Migration `0096_cnes_registry_and_ingestion`
