# ADR 0006 — Reintroducing a narrowed CNES registry schema

**Status:** Accepted · **Date:** 2026-08-10
**Supersedes in part:** the prohibition in `AGENTS.md` § `packages/cnes-ingestion — REMOVED`,
which requires "an ADR + product decision" before any reintroduction. This is that ADR.
**Superseded in part by:** ADR 0009 (2026-08-11) — manual loading becomes a Temporal worker, the
`ingestion` schema is readmitted for a run ledger only, and the `cnes_professional_id` consequence
below is **reversed**: it was measured at 100 % against the real export and is the join key.

## Context

Commit `a3e32ac5` (PR #188) deleted the entire CNES ingest vertical — 224 files:
`packages/cnes-ingestion` (FTP adapter, archive storage, parsers), `apps/workers/cnes-ingestion`
(Temporal monthly ingest workflow + 7 activities + reconcile/field-ownership services), and
`apps/api/src/modules/registry-ingestion` (~38 files: `/registry/*` routes, diff/projection/sync,
suggestion use-cases). Migration `0046` dropped `ingestion.cnes_diffs`, `cnes_runs`,
`cnes_suggestions`, five enums, and `DROP SCHEMA ingestion`.

The dropped `cnes_suggestion_type` enum included `FACILITY_PROFESSIONAL_ADD` and
`DOCTOR_CLINIC_REMOVAL` — the capability now being asked for again.

The removal was correct at the time: the product did not need the full national dataset, the
pipeline carried substantial operational weight (FTP, archive staging, monthly Temporal
workflows, a diff/suggestion review surface), and the warehouse was not earning it.

**What changed.** A concrete product requirement now depends on registry data that has no other
source: when a user adds a professional to a clinic, the system should show which professionals
CNES already associates with that clinic. Nothing in `public` can answer that —
`person_facilities` has no provenance by deliberate decision (ADR 0004 Q21, "links are always
manual"), and while a person carries `cnes_professional_id` and a facility carries `cnes_code`,
**nothing joins them**.

## Decision

Reintroduce a `registry` Postgres schema, **substantially narrower** than what was deleted.

**In scope**
- Three tables mirroring the CNES export, simplified: facilities, deduplicated professionals,
  and the professional↔facility vínculo rows.
- Read-only use by the application. The registry is reference data.
- **Manual loading** for now — the user loads data with scripts.

**Explicitly out of scope**
- No FTP adapter, archive storage, or monthly Temporal ingest workflow.
- No `ingestion` schema, no run/diff/suggestion tables, no suggestion review surface.
- No `/registry/*` API module.
- No write-back from registry to `public`.

**No stored link between `public` and `registry` for professionals.** The correspondence is a
**join on an identifier present in both**, evaluated per query. See spec 0012.

## Rationale

**Why a separate schema rather than tables in `public`.** The registry is externally sourced,
wholly replaceable, and read-only. `public` is authored by our users and authoritative. Keeping
them in separate schemas makes "truncate and reload the registry" a safe, obvious operation and
prevents accidental FKs from operational data into reference data.

**Why no stored link.** A stored correspondence would have to be rebuilt on every reload, and
rebuilding a fuzzy match is exactly the expensive, lossy step worth avoiding. A join is always
current by construction, requires no migration to `public`, and makes reload a `TRUNCATE`.

**Why manual loading.** The import pipeline was the majority of the operational cost of the
deleted system and provides none of the product value being asked for. Scope is currently
limited to facilities we already operate, so a scripted load is proportionate. If and when
scheduled refresh is needed, the self-provisioning Temporal schedule pattern from `bb40e971`
already exists to host it.

## Consequences

**Positive**
- Likely **zero changes to the `public` schema** — `facilities.cnes_code` and
  `person_professional_registrations` / `persons.cpf` already exist, unique and indexed.
- Reload is trivial and non-destructive to operational data.
- Gives the eventual CFM-portal import (spec 0012 §6) something to resolve against.

**Negative / accepted**
- The registry is a point-in-time snapshot with no freshness signal. Users may read stale
  associations as current fact. `imported_at` and "segundo o CNES em <data>" UI were considered
  and **deliberately deferred**.
- Reintroducing a schema that was recently deleted risks re-accumulating the machinery that made
  the original costly. The scope boundary above is the guard; widening it needs a new ADR.
- ~~**There is no unique CNES identifier that every professional carries.** The join key must be
  chosen from what the export actually contains, and its coverage measured before the feature is
  designed around it. Consequence: `person_healthcare_profiles.cnes_professional_id` (unique
  text since `0076`) is probably dead weight.~~
  **Reversed by ADR 0009.** The measurement was done: every professional carries
  `CO_PROFISSIONAL_SUS`, a 16-character hex id, on 100.00 % of the export's 7 761 583 rows, and
  all 1190 of our populated `cnes_professional_id` values were found in it. It is the join key,
  not dead weight.

**Neutral**
- ADR 0004 Q21 is **not** violated: CNES *suggests*, a human *confirms*, so every
  `person_facilities` row remains a manual act. Recording that a link originated from a CNES
  suggestion was considered and deferred.

## Alternatives considered

**Restore the deleted system.** Rejected — it solves a much larger problem at much larger cost,
and the reasons for its removal still hold.

**Store CNES associations directly in `public.person_facilities` with a provenance column.**
Rejected — it mixes externally-sourced claims with user-authored facts in one table, makes
reload destructive, and contradicts ADR 0004 Q21.

**Query a CNES API at request time.** Rejected — no suitable API, and it would put an external
dependency on a hot path.

**Materialise a `person_id ↔ cnes_professional_id` link table.** Rejected — must be rebuilt on
every reload, which is the fuzzy expensive step; a join gives the same answer, always current.

## References

- `AGENTS.md` § `packages/cnes-ingestion — REMOVED`
- ADR 0004 § 3 (out of scope), § 8 (identity matching precedence), Q21
- Spec 0012 — CNES registry & professional associations
- Commit `a3e32ac5`, migration `0046_crm_bigint_identity_cutover.sql`
