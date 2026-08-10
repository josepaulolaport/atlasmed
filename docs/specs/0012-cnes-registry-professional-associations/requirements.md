# Spec 0012 — CNES registry & professional associations

**Status:** Accepted (2026-08-10) · **Depends on:** ADR 0006 (schema reintroduction),
ADR 0004 (person/facility model, § 8 identity matching)

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
mobile surface that shows them.
**Out:** the import worker — data is loaded manually with scripts (ADR 0006).
**Data scope:** only facilities we already operate. Not the national CNES set.

## 3. Model

### 3.1 Registry tables

Mirror the CNES export, simplified — drop fields we do not need yet, **keep every identifier
candidate**.

```
registry.cnes_facilities
  surrogate PK, cnes_code (indexed), + the export's descriptive columns we keep

registry.cnes_professionals
  surrogate PK
  every identifier the export carries — CPF, CNS, any CNES professional code —
  each indexed; name; + kept descriptive columns

registry.cnes_professional_links
  FK → cnes_professionals, FK → cnes_facilities
  occupation / CBO
  + the vínculo attributes we keep
```

**Surrogate PKs, natural keys as indexed columns.** The join key is not yet known (§4), so the
schema must not commit to one. Choosing it later must be a query, not a migration.

**`cnes_professionals` is deduplicated at import.** The CNES export has one row *per employment
link*, so a doctor at three clinics appears three times — the raw shape has no professional
*entity*. Deduplication happens during load (`SELECT DISTINCT` over the identifier); it is not
present in the source and must be built.

**Carry the CBO/occupation on the link table.** It is what makes a suggestion useful —
"Dr. X, ortopedista, vinculado a esta clínica" rather than a bare name.

### 3.2 No stored link to `public`

Per ADR 0006. The correspondence is a **join evaluated per query**:

- **Facility side — already exists.** `facilities.cnes_code` (text, partial unique on active
  rows) ↔ `registry.cnes_facilities.cnes_code`.
- **Professional side — join key TBD (§4).** Both candidates already exist in `public`, unique
  and indexed:
  - `person_professional_registrations (council_id, state_code, registration_number)` — unique —
    if the export carries CRM
  - `persons.cpf char(11)` — unique where active — if the export carries CPF

⇒ **Likely zero changes to the `public` schema.**

Reload is `TRUNCATE` + load. Nothing to rebuild, and the join is always current — which is
exactly the "filter should represent the most recent state" requirement.

## 4. The identifier problem — resolve before building

**There is no unique CNES id that every professional carries.** This is the central unknown and
it must be settled against the real export before the query is designed.

Required investigation, in order:

1. **Inspect the actual export.** Which identifier columns exist — CPF, CNS, a CNES professional
   code, registration number?
2. **Measure coverage.** For each candidate: what fraction of rows have it populated? A key
   present on 60 % of rows produces a filter users read as "the system is broken", not as
   "partial data".
3. **Check it exists on our side.** The key must be present in both `registry` and `public`.
4. **Normalisation.** Leading zeros, spacing, UF case, punctuation in CPF — these silently fail
   to join. Whichever key is chosen needs a **normalised comparison column on both sides**, not
   an ad-hoc `LOWER(TRIM(...))` in the query.

Precedence when multiple keys are available — reuse ADR 0004 § 8, written for an import that
never shipped and directly applicable here:

> normalised CPF → registration `(council, state, number)` → verified `cnes_professional_id` →
> trusted external source key → weak signals produce a **possible-match warning, never an
> auto-merge**

**Consequence:** `person_healthcare_profiles.cnes_professional_id` (unique text since `0076`) is
probably dead weight. Confirm during investigation; drop it if so.

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

- Automated import worker (manual scripted load for now).
- `imported_at` on registry tables and "segundo o CNES em `<data>`" in the UI. **Accepted risk:**
  users may read a stale snapshot as current fact.
- Provenance on `person_facilities`.
- National-scale registry data.
- Any write-back from `registry` to `public`.

## 8. Acceptance criteria

1. A clinic with a `cnes_code` matching a loaded registry facility shows its CNES-associated
   professionals that exist in our database.
2. Professionals already linked to that facility do not appear in the suggestion section.
3. The "already associated" filter is applied **server-side**, not client-side.
4. Reloading the registry (`TRUNCATE` + load) changes the suggestions and requires **no**
   migration or relink step.
5. The chosen join key's coverage is **measured and documented** before the UI ships.
6. Associating a suggested professional creates an ordinary `person_facilities` row,
   indistinguishable from a manual association.

## 9. Out of scope

FTP/archive ingest · Temporal ingest workflows · `ingestion` schema · diff/suggestion review
surface · `/registry/*` API module · write-back to `public`.
