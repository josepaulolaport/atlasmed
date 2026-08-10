# ADR 0007 — The cadastro document is the unit, not the package

**Status:** Accepted · **Date:** 2026-08-10
**Supersedes:** spec 0010 §1.6 ("Cadastro submissions key on `facility_vertical_profile_id`",
"one DRAFT per profile") and spec 0011 §5's retention of package versioning.
**Cancels:** P2-3 part two, which would have re-keyed `cadastro_submissions` onto the profile.

## Context

`cadastro_submissions` models a *package*: a versioned envelope holding one document per
requirement, with its own status (`DRAFT` → `SUBMITTED` → `APPROVED` / `CHANGES_REQUESTED` →
`SUPERSEDED`).

Nothing uses it that way.

| what the package is meant to provide | what actually happens |
|---|---|
| the submit action | `submitPackage` has **no caller**. Mobile calls `submitRequirement` — one document at a time |
| version history | `submission_documents.version` already exists and is what the code reads |
| lifecycle status | `submission_documents.status` carries the full enum and is what drives behaviour |
| the review target | `review_decisions.submission_document_id` — reviews attach to **documents**; there is no package review |
| completion | `FacilityCadastroCompletionService` reads document status, never package status |

`cadastro_submissions.version` is read in exactly one place: line 947, inside the clone described
below.

So the package is a layer every consumer routes around. It is not merely unused — it is actively
harmful in two ways.

**The CHANGES_REQUESTED clone.** Rejecting *one document* supersedes the package, creates a new
version, and clones **every** document and every file row into it
(`cadastro-submission.use-cases.ts:925-985`). Spec 0011 §6 already flags that this is not
transactional: a crash mid-loop leaves a superseded package plus a half-built draft, and the
partial-unique DRAFT index then rejects every retry (D-16). A clinic's cadastro wedges
permanently, and the only signal is a rep saying "it doesn't work".

**Two submit paths, two rules.** Spec 0011 §5: the package path enforces `requiresFrontAndBack`
strictly (`:840-848`), the per-requirement path leniently (`:1201-1214`). The lenient one is the
live one.

## Decision

**Delete `cadastro_submissions`.** A cadastro document belongs directly to a facility.

```
facility
  └─ submission_documents   (requirement, facility_vertical_profile_id | NULL, version, status)
       └─ document_files
            └─ file_assets
```

- **A document is the unit.** It is uploaded, submitted, reviewed, approved and versioned on its
  own. That is already true in behaviour; this makes it true in the schema.
- **`facility_vertical_profile_id` on the document, nullable.** The document records which linha's
  requirement it satisfies. `NULL` means facility-scoped — a Cartão CNPJ is uploaded once and
  counts for every linha (spec 0011 §3.2 already defines `conformity_requirements.vertical_id`
  this way; the document mirrors it).
- **Cadastro is one page per clinic.** On opening a clinic the API intersects the caller's
  verticals with the clinic's, and returns the requirements for that intersection plus the
  facility-scoped ones. No linha switcher, no per-linha package.
- **Deleted with the package:** the CHANGES_REQUESTED clone, `SUPERSEDED`, package status,
  package version, `submitPackage` / `canSubmitPackage`, and the package-submit route.
- **`CHANGES_REQUESTED` becomes a document status change** — one row, one write. This is the
  answer to D-16: the safest version of the clone is the one that does not exist.
- **Uniqueness moves down:** `unique(facility_id, requirement_id, version)`. The "one DRAFT per
  facility" partial index disappears with the package that held it.
- **A null scope column means "applies to everyone", for both scoping columns.**
  `conformity_requirements` has two: `vertical_id` and `applies_to_legal_document_type`. They
  behaved oppositely — a null vertical was *included* (spec 0011 §3.2: satisfied once, counts for
  every linha) while a null legal type was *excluded*, to stop legacy shared rows leaking into
  checklists. That defence guarded against rows that no longer exist: the table is empty in
  production. Two nullable scope columns where null means "everyone" in one and "nobody" in the
  other is a trap for whoever adds the next requirement. One rule now: **null = unscoped =
  applies to all.**

  Concretely, a Cartão CNPJ is `vertical_id = NULL` (every linha) and
  `applies_to_legal_document_type = 'CNPJ'` (companies only); a CPF clinic gets its own identity
  document instead.

## Consequences

**Better.** The wedge in D-16 becomes unreachable. One submit path, one validation rule. Per-linha
completion falls out naturally — a linha is complete when every requirement for it, plus the
facility-scoped ones, has an approved document. A shared document is stored once rather than
duplicated per linha.

**Costs.** Two were claimed while drafting this ADR and both were wrong — inferred from the
schema without checking the consumers. Recorded because the reasoning is the point:

- *"The OPS review queue must be rebuilt."* It must not. `cadastros_review_list_screen` already
  fetches `/cadastro/submissions` and renders one row per **document**
  (`{ facilityName, requirement, status }`), and approves via
  `/facilities/:id/cadastro/documents/:id/review`. The reviewer already works document by
  document. `GET /cadastro/packages` — the endpoint the concern was about — has no consumer at
  all. The reviewer's screen does not change.
- *"Optimistic concurrency moves from package to document."* It does not exist. There is no
  `expectedVersion` or conflict check anywhere. Spec 0011 §4.5 describes something to build, and
  under this model it lands on the document, where two reps editing *different* documents do not
  contend at all — strictly simpler than the package version it imagined.

The one real consequence: there is no longer a single object meaning "this clinic's cadastro
attempt №2". Version lives per document. Nothing reads the package version today except the clone
being deleted, so this is a loss on paper — but reconstructing "the state of everything as of
attempt 2" would now mean joining document versions and timestamps.

**Why not keep the package as a pure container?** Considered. It would still own the DRAFT
uniqueness index, still need the clone or its removal, and still leave two levels of `version` and
`status` where consumers read only the lower one. A container that nothing consumes is a
join nobody needs.

## Migration

All cadastro tables are empty in production (`cadastro_submissions`, `submission_documents`,
`document_files`, `conformity_records`, `conformity_requirements` — verified 0 rows against the
2026-08-10T10:47Z dump), so there is no data to move and the migration is structural only. The
guard pattern used in 0078–0083 applies: refuse if that has changed.
