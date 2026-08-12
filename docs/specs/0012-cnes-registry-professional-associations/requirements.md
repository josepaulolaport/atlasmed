# Spec 0012 — CNES registry & professional associations

**Status:** Accepted (2026-08-10) · **Depends on:** ADR 0006 (schema reintroduction),
ADR 0004 (person/facility model, § 8 identity matching)
**Amended 2026-08-11 by ADR 0009:** §4's identifier question is settled by measurement — the join
is the single column `cnes_professional_id`, not a composite. §2 and §9 no longer exclude the
import worker or the `ingestion` run ledger.

---

## 1. Problem

When a user adds a professional to a clinic, they have no way to know which professionals CNES
already associates with that clinic.

Today's flow is the inverse of what is wanted:
`facility_associate_repository.dart:59` fetches **every doctor in the CRM** and filters
client-side to *exclude* those already linked — and it does not even pass `facilityId` to the
API, though the endpoint supports it.

Nothing in `public` can answer the question. `person_facilities` has **no provenance column** by
deliberate decision (ADR 0004 Q21). A person carries `cnes_professional_id`; a facility carries
`cnes_code`. **Nothing joins them.**

## 2. Scope

**In:** the `registry` schema, the join that resolves CNES associations to our persons, and the
mobile surface that shows them. Since ADR 0009, also the ingestion worker and its run ledger.
**Data scope:** only facilities we already operate. Not the national CNES set.

## 3. Model

### 3.1 Registry tables

Mirror the CNES export, simplified — drop fields we do not need yet, **keep every identifier
candidate**.

As built in `0096` — the schema qualifier already says CNES, so the `cnes_` prefixes this section
originally proposed were dropped:

```
registry.facilities                          PK cnes_id (CO_CNES)
registry.professionals                       PK cnes_id (CO_PROFISSIONAL_SUS) ← the join key
registry.professional_registrations          FK → professionals; (council, UF, número)
registry.facility_professionals              PK (facility_cnes_id, professional_cnes_id)
registry.facility_professional_occupations   PK (facility, professional, CBO)
registry.professional_councils               seeded by hand, never ingested (ADR 0009)
registry.occupations / states / municipalities   CNES catalogues
```

Each table carries a nullable `atlasmed_id` bridging to `public`, unique where set, and never a
hard FK — the two schemas have opposite lifecycles.

**Natural CNES keys are the primary keys**, not the surrogates this section first proposed. That
call was made to avoid committing to a join key before §4 was measured; the vínculo and occupation
tables separate the concerns instead, so nothing depends on which identifier turned out to win.

**Occupation is its own table, not a column on the vínculo.** One person genuinely holds several
CBOs at one establishment, so folding CBO into the vínculo key would multiply the row and break
"one row per person per clinic".

**`cnes_professionals` is deduplicated at import.** The CNES export has one row *per employment
link*, so a doctor at three clinics appears three times — the raw shape has no professional
*entity*. Deduplication happens during load (`SELECT DISTINCT` over the identifier); it is not
present in the source and must be built.

**Carry the CBO/occupation on the link table.** It is what makes a suggestion useful —
"Dr. X, ortopedista, vinculado a esta clínica" rather than a bare name.

### 3.2 No stored link to `public`

Per ADR 0006. The correspondence is a **join evaluated per query**:

- **Facility side.** `facilities.cnes_code` (text, partial unique on active rows) ↔
  `registry.facilities.cnes_id`.
- **Professional side — settled (§4).** One column, exact:

  ```sql
  registry.professionals.cnes_id = person_healthcare_profiles.cnes_professional_id
  ```

  Both sides are already unique and indexed — the registry column is its primary key, ours is
  `person_healthcare_profiles_cnes_professional_id_uidx` (partial unique since `0076`).

⇒ **Zero changes to the `public` schema**, as predicted.

Reload is `TRUNCATE` + load. Nothing to rebuild, and the join is always current — which is
exactly the "filter should represent the most recent state" requirement.

## 4. The identifier problem — settled by measurement

This section posed the central unknown: which identifier joins CNES professionals to ours. It was
measured against the real 202605 export on 2026-08-11 (ADR 0009). **The answer is
`CO_PROFISSIONAL_SUS`**, a 16-character uppercase hex id, which we already store as
`person_healthcare_profiles.cnes_professional_id`.

| | |
|---|---|
| export rows scanned | 7 761 583 |
| rows carrying the id, `^[0-9A-F]{16}$` | 7 761 583 (**100.00 %**) |
| our profiles with it populated | 1190 of 1205 (98.8 %) |
| of those, found in the export | **1190 (100.0 %)** |

The candidates this section proposed both lose to it:

- **CPF** — CNES masks it in the public dump (`XXX.392.286.XX`, 5 of 11 digits redacted) on every
  row. Unusable.
- **Registration `(council, UF, número)`** — present, but sparse outside doctors, and it needs
  normalised columns on both sides plus a council-code bridge to reach a population the hex id
  already covers completely.

**Normalisation is therefore not needed on the primary path** — the id is a fixed-width hex
string with no padding, spacing or case variance. Item 4 above still applies to the registration
fallback, and our own `registration_number` has two leading-zero rows that must be normalised
before that path ships.

Precedence from ADR 0004 § 8 is unchanged; this simply promotes its "verified
`cnes_professional_id`" rung to first, on evidence:

> normalised CPF → registration `(council, state, number)` → verified `cnes_professional_id` →
> trusted external source key → weak signals produce a **possible-match warning, never an
> auto-merge**

**Consequence — reversed.** `cnes_professional_id` is not dead weight and must not be dropped. It
is the join. The fallback covers the 15 profiles without one; 7 of those have a registration, so
8 people are unmatchable by any key (0.7 %).

## 5. Product flow

**Now.** When a user adds a professional to a clinic, the sheet shows a section of professionals
that **CNES associates with this clinic AND that already exist in our database** — resolved via
the §3.2 join, excluding those already linked to this facility. One tap associates them, creating
a normal `person_facilities` row.

Professionals CNES lists at the clinic but which do **not** exist in our database are **not
shown** in this pass. Surfacing them would require creating a person from registry data, which is
§6.

Two immediate improvements independent of the registry, worth taking with it:
- Push the "already associated" filter **server-side** — the endpoint already accepts
  `facilityId`.
- Show an explicit "já associados nesta clínica" section fed by `activeFacilityIds`, which is
  already in the Meilisearch person index.

**ADR 0004 Q21 is preserved.** CNES *suggests*; a human *confirms*. Every `person_facilities` row
remains a manual act. Recording that a link originated from a CNES suggestion was considered and
**deferred** — no provenance column in this pass.

## 6. CFM portal import — deferred, documented

Source: `https://portal.cfm.org.br/busca-medicos`.

When a user cannot find a doctor in our database, they import directly from CFM. The record is
created from an authoritative registry, then we make a **best-effort** attempt to resolve them in
the CNES data. Success is a bonus, not a precondition — an imported doctor is usable either way.
Once resolved, they appear in the CNES association filter.

⚠️ **This partially reverses `ad80e203`**, which removed the create-doctor flow with the note
*"Product has no create-doctor surface; keep associate-existing only."* The reversal is on
different grounds: that removal targeted **free-form typing producing junk records**; CFM-sourced
creation pulls from an authoritative registry. Same principle as registry-import-instead-of-create
for facilities (spec 0010 § 6). Record this reasoning in the implementing PR so the reversal is
not read as a regression.

Note the vestigial `splitPersonName` helper (`facility_associate_repository.dart:234`), orphaned
by `ad80e203`, may become relevant again — or should be deleted now and rewritten deliberately.

## 7. Deferred

- ~~Automated import worker (manual scripted load for now).~~ **In scope since ADR 0009.**
- The registration `(council, UF, número)` fallback, and the normalisation it needs on both
  sides. Covers 7 of the 15 profiles without a CNES id; 8 remain unmatchable.
- `imported_at` on registry tables and "segundo o CNES em `<data>`" in the UI. **Accepted risk:**
  users may read a stale snapshot as current fact. `ingestion.cnes_runs` records the load time
  but nothing surfaces it.
- Provenance on `person_facilities`.
- National-scale registry data.
- Any write-back from `registry` to `public`.

## 8. Acceptance criteria

1. A clinic with a `cnes_code` matching a loaded registry facility shows its CNES-associated
   professionals that exist in our database.
2. Professionals already linked to that facility do not appear in the suggestion section.
3. The "already associated" filter is applied **server-side**, not client-side.
4. Reloading the registry changes the suggestions and requires **no** migration or relink step.
   (The load is incremental per table rather than `TRUNCATE` — aux rows and the `atlasmed_id`
   bridges survive; only the facility↔professional roster is replaced wholesale.)
5. The chosen join key's coverage is **measured and documented** before the UI ships. ✅ §4.
6. Associating a suggested professional creates an ordinary `person_facilities` row,
   indistinguishable from a manual association.
7. A monthly run records its outcome in `ingestion.cnes_runs`, and a failed run is visible
   without reading logs. *(added by ADR 0009)*
8. A doctor who leaves a clinic stops being suggested after the next run — **including when that
   clinic reports no doctors at all**, which is the case the first loader skipped.

## 9. Out of scope

Archive storage · diff/suggestion review surface · `/registry/*` API module · write-back to
`public` · national-scale registry data.

*(ADR 0009 removed "FTP/archive ingest", "Temporal ingest workflows" and "`ingestion` schema"
from this list. The worker reads the archive over ranged FTP without storing it, and `ingestion`
carries a run ledger only — no diff or suggestion tables.)*
