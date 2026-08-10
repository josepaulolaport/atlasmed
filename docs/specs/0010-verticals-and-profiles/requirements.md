# Spec 0010 — Business Verticals, Facility Profiles & Relevance

**Status:** Accepted (2026-08-09) · **Supersedes:**
`docs/architecture/features/business-verticals.md` (stale — cites a
`ScopeResolver.applySectorFilter` method that does not exist, claims `territories.sector_id`
was dropped when `vertical_id` is `NOT NULL` and load-bearing, §4 contradicts §11.3, misses the
`Estética` rename, and never mentions the `potential` module).
**Amends:** ADR 0003 (§4.4), ADR 0005 (§5.4).

---

## 1. Model

`business_verticals` ("linha comercial") is a **table**, not an enum. Live rows: `ORTOPEDIA`
(displays *Ortopédica*), `DERMATOLOGIA` (displays **Estética** — renamed in `0041`).

Twelve tables carry `vertical_id`. Persons/professionals deliberately do not.

### 1.1 Vertical membership is asserted, and constrains territories

`user_vertical_assignments` (UVA) is the **single source of truth**.

**Today (wrong):** scope unions UVA with `SELECT DISTINCT territories.vertical_id` of the
user's territory assignments (`drizzle-scope.repository.ts:157-162`), while
`GET /user/assignments` reports **UVA only**. Effective access silently exceeds anything any UI
shows — assign a territory and the user gains that vertical everywhere.

**Required:**
- **Drop the union.** UVA is the only grant.
- **Add invariant I6:** a user may hold a territory only in a vertical they are already
  assigned. The union becomes redundant because every territory's vertical is necessarily in
  UVA.
- **Revoking a vertical from a user holding territories in it is BLOCKED** — "remove their
  territories first". Never silently end UTAs.

No backfill needed; no violating rows exist.

### 1.2 The profile is the unit of visibility

`facility_vertical_profiles` (one per facility × vertical) carries commercial state,
`manager_zone_id`, and parents the rep assignment. **Its existence determines whether a clinic
is visible in that vertical.**

**Creation triggers:**
1. **Rep assignment** — already implemented and correct
   (`drizzle-facility-vertical-rep-assignment.repository.ts:155-170`, inside the assign
   transaction; creates or reactivates).
2. **Order creation** — get-or-create. Becomes structural once §4 lands.
3. **Facility creation** — see §1.5.

**Assignment is a forward-looking commitment, not commercial activity.** An assigned clinic
that has never bought is exactly a `NEVER_PURCHASED` profile in the denominator — which is why
assignment works as a trigger and *order-only* does not.

**Rejected:** triggering on commercial activity alone. It makes `neverBought` structurally
zero, coverage reads 100% forever, and the metric dies.

**Profiles are never deleted.** A clinic that stops being relevant keeps its profile, its funnel
history, and its orders; only its state changes. Deactivation is admin-only, via
`facility_vertical_profiles.is_active` / `DELETE /facilities/:id/verticals/:verticalId`, and is
**requested** by a manager rather than executed by one.

**Orders override rules.** An order creates a profile even where relevance rules would not — an
order is a fact, rules are a prediction.

### 1.3 Why profiles exist today (context)

`0024_business_verticals_p0.sql:200-222` ran a one-time `CROSS JOIN`: every facility × ORTOPEDIA.
That backfill is the only reason the dashboard has numbers. **It was never made a rule**, so any
facility created since has no profile — invisible to non-admins and absent from every
denominator. `0027_seed_dermatologia.sql` explicitly created no profiles, so
Estética/Dermatologia has none.

This spec turns that one-shot into a continuous invariant.

### 1.4 Manager metrics: two ratios, not one

| Metric | Formula | Question |
|---|---|---|
| **Conversão** | bought / assigned | are reps converting what they work? |
| **Cobertura de território** | assigned / clinics-in-zone | are we working enough of the territory? |

The second is a **geometry count**, not a profile count — no relevance data required. Unassigned
in-zone clinics surface as an actionable **worklist** ("42 clínicas na sua zona sem
representante") rather than as an invisible denominator term.

A single blended ratio hides which problem a manager has. Two ratios say whether to push
conversion or push coverage.

### 1.5 The profile is the commercial hub (architectural principle)

**Everything commercial hangs off `facility_vertical_profiles`. The facility holds only
physical facts** — address, coordinates, `cnes_code`, legal document, contact details.

| Entity | Keyed on | Status |
|---|---|---|
| Rep assignments | `facility_vertical_profile_id` | ✅ already |
| Orders | `facility_vertical_profile_id` | §4 of this spec |
| Cadastro submissions | `facility_vertical_profile_id` | §1.6 |
| Conformity status | on the profile | §1.6 |
| Potential values | facility + definition (definition carries the vertical) | already vertical-scoped transitively |

This decides where future entities go without re-litigating it: if it describes a commercial
relationship it keys on the profile; if it describes the building it keys on the facility.

### 1.6 Cadastro is per profile, not per facility

> ⚠️ **SUPERSEDED by ADR 0007 (2026-08-10).** The premise below is right — a facility-wide
> conformity verdict is meaningless — but the conclusion is wrong. Cadastro submissions are NOT
> re-keyed onto the profile: the *package* is deleted entirely and the **document** becomes the
> unit, carrying a nullable `facility_vertical_profile_id`.
>
> Investigation showed the package is a layer every consumer routes around: `submitPackage` has no
> caller, reviews attach to documents, completion reads document status, and the package version
> is read only by the CHANGES_REQUESTED clone that wedges clinics (D-16). Re-keying it would have
> preserved machinery that should be removed.
>
> Still correct below and implemented: `commercial_status` → `conformity_status` on the profile,
> `facilities.conformity_status` removed, `purchase_status` dropped, and requirements filtered by
> vertical (D-49). Read the rest with the package claim struck out.

Different verticals require different documents, so a single facility-wide conformity verdict is
meaningless.

**Decided:**
- **`facility_vertical_profiles.commercial_status` → renamed `conformity_status`.** It already
  *is* cadastro completion and it is already on the profile; only the name was wrong. Keep the
  values (`UNREGISTERED`/`REGISTERED`/`SUSPENDED`; `CLOSED` is unreachable). Rename the Postgres
  column and enum type only — **api-only, zero mobile files** (see §5.2).
- **`facilities.conformity_status` is REMOVED.** The facility-level verdict is the incoherent
  one. Nothing replaces it; consumers read the profile.
- **`purchase_status` (column + enum) is DROPPED entirely.** `purchase_funnel_stage` is the
  single source for filtering, display and calculations. Nothing displays `purchase_status`
  today — its whole mobile render path is dead code (§5.1).

  *Verified on implementation (2026-08-10, migration 0080).* The claim is precise and worth
  restating, because it looks false at a glance: `clinic_status_signals_section.dart` does
  render `purchaseStatus` as a labelled "Tipo de cliente" row — but that widget is **never
  mounted anywhere**. The only other reference was a repaint comparison in
  `clinic_detail_screen.dart` on a field that is `NON_BUYER` for every row, so it could never
  fire. Production confirmed the same: all 1443 profiles `NON_BUYER`, zero exceptions.

  The funnel was already what reps actually see — `buildFacilityStatusChips` renders it in
  both `clinic_row` and `clinic_header_section`, the explore filters key on it, and the
  dashboard's `purchaseStatus` block is computed from `purchase_funnel_stage` despite its
  name. So nothing needed rewiring; the drop removed dead code only.
- **Cadastro submissions key on `facility_vertical_profile_id`**, replacing
  `facility_id` + nullable `vertical_id`.
- The "one DRAFT per facility" partial unique index becomes **one DRAFT per profile**.
- `FacilityCadastroCompletionService` computes per profile.
- `findActiveRequirements` **must filter by vertical** — it currently ignores
  `conformity_requirements.vertical_id` entirely (D-49).

**Requirement scoping — option (b), decided.** Some documents are the clinic's, not the linha's
(CNPJ card, contrato social, alvará). Requiring them once per profile would mean uploading,
reviewing and expiring the same document twice for a two-vertical clinic.

⇒ **`conformity_requirements` are either facility-scoped or vertical-scoped.**
A **null `vertical_id` means facility-scoped**: satisfied once, counts for every profile of that
facility. A non-null `vertical_id` means the requirement applies only to that vertical. This is
almost certainly what the existing nullable column was for.

Rejected: (a) everything per-profile — duplicated uploads and reviews;
(c) documents at facility level with per-profile submissions — most flexible, disproportionate
complexity for the need.

**Backfill:** existing submissions carry `facility_id` + nullable `vertical_id`;
`cadastro-vertical-inference.utils.ts` already exists to resolve the vertical. Submissions that
still cannot be resolved need an explicit decision rather than a silent default.

**Frontend wiring is an explicit acceptance criterion** (user). Mobile already passes
`verticalId` to some cadastro endpoints (`facility_cadastro_repository.dart:319-327,512-526`),
so the groundwork is partial — but every cadastro screen, the conformity chip, the "Status"
filter and the ops review queue must be verified against the per-profile model, not assumed.
The same clinic may legitimately read **Operante** in Ortopedia and **Pré-cadastro** in Estética;
the UI must be able to express that.

### 1.7 Facility creation

Takes an explicit `verticalId` (or the user's only one when unambiguous) and **always creates
the profile**. Dedupe on `cnes_code` (partial unique index exists) and on CNPJ — note `0074`
**dropped** the unique constraint on `facilities.legal_document`; revisit if CNPJ dedupe is
wanted.

Superseded long-term by §6 (registry import replaces free-form creation).

---

## 2. Authorization

### 2.1 The vertical parameter is a filter, never a grant

`resolveAccessibleVerticalIds` (`packages/access/src/permissions/vertical.permissions.ts:24-47`)
validates the requested vertical is a **subset** of the caller's assigned set and throws
`forbidden` otherwise. Omit it and you get your own verticals. Send someone else's and you get
403. **The parameter can only ever narrow.**

Therefore transport is an ergonomics question, not a security one. **Delete the
`X-AtlasMed-Vertical-Id` header** (one sender, which also passes the query param) and
standardise on `?verticalId=`.

The real risk is surfaces that skip the helper — §2.2.

### 2.2 Gaps to close

- `POST /territories` accepts any `verticalId` with no ⊆-assigned check
  (`territories.route.ts:119,129`).
- `getTerritory(id)` performs **no scope check at all** (`territory-crud.use-cases.ts:166-172`).
- Cadastro takes `verticalId` verbatim, unvalidated
  (`cadastro-vertical-inference.utils.ts:34-36`); branch 1 (:23-25) returns a single active
  profile even when the caller is not assigned to it.
- Territory list treats `verticalId` as a cosmetic filter, never intersected with
  `assignedVerticalIds`.

### 2.3 Roles

**OPS = REP + cadastro approve/reject**, minus rep-specific actions (clinic and territory
assignment). Grant the missing `CATALOG` permission (an oversight — OPS currently cannot even
*read* potential definitions) and fix `ROLE_PRIORITY` giving OPS and REP both priority 1
(`ui.permissions.ts:4-9`).

⚠️ Because OPS cannot be assigned to anything, OPS cannot be territory-scoped and is therefore
**vertical-wide/national** — broader visibility than any rep.

**ADMIN scoped to their verticals, plus a future SUPERUSER: deferred.** Non-trivial —
`isGlobal` currently short-circuits `assertResourceInScope` entirely, and this splits it into
independent territory and vertical axes, touching every `isGlobal` check.

### 2.4 Endpoint consolidation

Two `/business-verticals` endpoints exist with different shapes and permissions —
`/access/business-verticals` (`read USER`, plain array) and `/business-verticals`
(`read CATALOG`, paginated). **Neither filters by the caller's assignments.** Consolidate to
one, filtered.

---

## 3. Vertical-specific behaviour must be data-driven

**Today:** the mobile client gates payer shares by **substring of the display name** —
`code.contains('ORTOPEDIA') || name.contains('ORTOP')`
(`clinic_detail_linha_provider.dart:124-128`) — while the server gates by code
(`payer-shares-access.service.ts:5`). **The `Ortopédica` rename in `0039` is load-bearing for a
string match.** Renaming a vertical in an admin screen silently changes feature behaviour.

**Required:** give verticals **capability flags**, returned in the DTO. Clients render from
flags (`if (vertical.features.payerShares)`); the server gates on the same flags, so the two
cannot diverge. Adding a vertical becomes configuration, not code.

Also replace the hardcoded invented category list at `new_order_products_screen.dart:39-46`
(`Cardiologia`, `Diagnóstico`, `Suplementação` do not exist) with real verticals.

---

## 4. Orders key on the profile

**Replace `orders.facility_id` + `orders.vertical_id` with a single
`orders.facility_vertical_profile_id` FK.**

Rationale:
- **The database enforces what code currently forgets.** An order cannot exist without a
  profile — no validation to remember, no importer that can bypass it.
- **Precedent in the schema:** `facility_vertical_rep_assignments` already keys on
  `facility_vertical_profile_id`, not on a facility+vertical pair.
- **Fixes the penetration numerator for free** — it currently filters `facility_id` only and
  ignores `orders.vertical_id` (`drizzle-potential.repository.ts:199-201`).
- **Simplifies the funnel**, which lives *on* the profile: a direct join instead of matching
  `(facility_id, vertical_id)` pairs.

`orders.vertical_id` becomes derivable and is dropped.

**Migration:** backfill each order to its profile. Orders whose `(facility, vertical)` pair has
no profile are **existing orphans** — create profiles or quarantine. **That backfill count is
the measurement of how many orders the Emultec importer wrote with no profile.** Rebuild
`orders_valid_purchase_facility_vertical_ordered_at_idx` against the FK. Vertical-filtered order
queries gain a join (cheap, indexed). Safe only because profiles are never deleted.

**Amends ADR 0003** — funnel rules unchanged, keying changed.

---

## 5. Known-wrong things to fix while here

### 5.1 `purchase_status` is dead
`NON_BUYER|LOW_BUYER|REGULAR_BUYER|HIGH_BUYER` has **no UPDATE and no non-default INSERT
anywhere**. Last real values came from the `0024` backfill. Every row reads `NON_BUYER` forever.
The dashboard correctly uses `purchase_funnel_stage`, but its repo type is named
`PurchaseStatusBuckets` — actively misleading. Remove or repopulate; do not leave both.

### 5.2 `commercial_status` is not commercial
It is **cadastro document completion**, per vertical, written only by
`FacilityCadastroCompletionService`. `UNREGISTERED` = never completed, `REGISTERED` = complete,
`SUSPENDED` = regressed. **`CLOSED` is unreachable.** It is exposed to users as a filter
labelled "Status". Rename to reflect meaning.

### 5.3 Dashboard scoping
`coveragePercent = round(((active + inactive) / total) * 100)`, one formula reused for both the
`purchaseStatus` and `territory` blocks. Buckets come from `purchase_funnel_stage`. The
denominator is the count of `facility_vertical_profiles` rows in scope, scoped by
`scope.facilityIds` — **`manager_zone_id` is not used by the bucket query at all**; it only
feeds map polygons. ADMIN gets `facilityIds = null` ⇒ unbounded national aggregate labelled
"Brasil · visão geral". Deactivated facilities are not excluded.

### 5.4 Multi-vertical collapse
List rows fill a single `consultantName`/`consultantSince` from the **lowest `verticalId`**
(`drizzle-facility.repository.ts:311-332`). A clinic with reps in two verticals shows one
arbitrarily.

**Required:** return **all** reps with their verticals, filtered to the caller's accessible set.
DTO shape change (scalar → array) plus a list-row UI change. **Amends ADR 0005**, which records
this as "Deferred".

### 5.5 Competitor verticals derive from equivalences
A competitor product is ortho-relevant *because* it competes with an ortho product — a property
of the relationship, not the product. Filter comparisons by the AtlasMed product's vertical
(`catalog.use-cases.ts:856-870` currently calls `findAllActive()` with no vertical argument).
Keep `competitor_product_verticals` only if tagging a competitor before any equivalence exists
is required; otherwise it is a second source of truth that will drift.

### 5.6 `conformity_requirements.vertical_id` is never filtered on
`conformity.use-cases.ts:5-23` returns all active requirements and merely echoes `verticalId`.
Decide whether cadastro checklists are vertical-specific.

---

## 6. Target architecture — relevance rule engine (NOT scheduled)

Reviewed and agreed as the destination. **Not in the current pass** — profiles are currently
created by a manual script during the testing phase.

**Profile existence IS visibility.** The rule engine materialises profiles; there is no separate
relevance attribute and no predicate evaluated at read time.

```
relevant(clinic, V) =
     clinic.unit_type_id     ∈ V.configured_unit_types
  OR clinic.clinical_focuses ∩ V.configured_focuses ≠ ∅
  OR manually added
  AND NOT admin-deactivated
```

**Rules, not a classifier.** Statistical/ML classification is rejected — non-deterministic and
unexplainable; a manager cannot be held to a coverage number nobody can inspect. Rules are
admin-configured, inspectable, and shaped like `product_potential_definitions` (an
admin-curated per-vertical rule set) — reuse that pattern.

**Two idempotent, queue-driven workers:**
1. **Registry → facilities** — imports from the CNES registry only facilities that will get a
   profile. Needs a **full re-scan mode**: if rules later become more permissive,
   previously-skipped records never return on their own.
2. **Sweep over existing facilities** — adds profiles wherever rules match.

**Triggers:** new facility · manager assigned a territory · territory changed · **facility
updated**.

**Invariant:** every facility has at least one profile (active or inactive). ⚠️ Needs a legacy
check — facilities imported before the rules exist may match nothing.

**Escape hatches:**
- Facility exists but has no profile in my vertical → **user adds it manually**, self-service.
  *Adding a clinic makes coverage worse (bigger denominator, same numerator), so self-service
  addition cannot be gamed. Removal makes it better, which is why removal is admin-only.*
- Facility does not exist → **import from the Registry**, never free-form creation. Keeps a
  clean facility → CNES relation and prevents junk facilities.

**Principle established: whoever is measured must not control the denominator.**
Manager-initiated exclusion was proposed and rejected for this reason.

**Rule changes** must be timestamped so a manager can see why their coverage moved, and must
distinguish rule-matched / retained / manually-added / admin-deactivated on the profile row.

### 6.1 Blocking data reality

- `clinical_focuses` — empty table, **zero** insert sites repo-wide, read-only filter catalog.
- `unit_types`/`unit_subtypes` — no seed migration, `unit_type_id` **never written** by any code,
  no `/unit-types` endpoint. `0055` dropped the old catalogs and destroyed the data; `0056`
  recreated them empty. `facility-unit-catalog.utils.ts` is fully tested and unreachable.
- **No vertical↔focus or vertical↔unit-type mapping exists** anywhere.

Data was populated by manual SQL, so **seeding is solved and maintenance is not**: every
facility created from now on has no classification, silently. A classification write path on
facility create is required before the rule engine is meaningful — and this is the strongest
concrete argument for CNES professional/classification import.

---

## 7. Defects closed

D-06, D-09, D-10, D-24, D-28, D-29, D-30, D-31, D-32, D-44, D-45, D-46, D-47, D-48, D-49, D-50,
D-51, D-53. See `.ai/backlog/2026-08-09-defect-register.md`.

## 8. Out of scope

Web UI (parked). ADMIN vertical scoping and SUPERUSER (deferred, §2.3). The rule engine (§6).
CNES registry ingest.
