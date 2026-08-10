# Spec 0009 — Territory & Clinic Ownership

**Status:** Accepted (2026-08-09) · **Supersedes:** `0003-territory-management/requirements.md`,
`0003-territory-management/vertical-ownership-design.md`, and the Phase-1 sections of
`0006-shared-territory-clinic-ownership/requirements.md`.

Those three documents contain claims that are false in code (a grouping hierarchy deleted in
migration `0005`, endpoints that do not exist, an approval workflow dropped in `0049`,
multi-REP-per-patch contradicted by `territory-assignment-policy.service.ts:56`). Do not read
them as current. This spec is written from verified code plus product decisions.

---

## 1. Model

### 1.1 The governing distinction

Two kinds of link, with opposite handling rules. Conflating them is the root cause of most
defects in this area.

| | Derived | Asserted |
|---|---|---|
| Example | clinic → manager zone | clinic → rep |
| Decided by | geometry | a human |
| On recompute | safe to overwrite; it is a projection | **must never be silently destroyed** |
| Needs confirmation | no | **yes, always** |

**Rule: machines may create, only humans may destroy.**

### 1.2 Territory kinds

| | `manager_zone` | `patch` |
|---|---|---|
| Sibling overlap | forbidden | **allowed** |
| Parent | — | a zone, `ST_CoveredBy` it |
| Occupancy | exactly one MANAGER | exactly one REP |
| Vertical | `vertical_id NOT NULL` | `vertical_id NOT NULL` |

Zones of **different verticals may overlap freely**. Zones of the **same vertical must never
overlap**.

### 1.3 Who sees what

- **REP** — only clinics with an active `facility_vertical_rep_assignments` row for them. A
  patch grants *eligibility and map context*, never clinic access.
- **MANAGER** — all clinics in their zones, so they can review and assign unassigned ones.
- **OPS** — all clinics with a profile in their verticals, nationally (see Spec 0010 §V11).
- **ADMIN** — all territories; vertical scoping deferred (Spec 0010 §V12).

Clinics are **never** assigned to patches. Patches may overlap, so patch membership cannot
express ownership. Ownership is only ever an explicit per-clinic assignment.

---

## 2. Invariants

- **I1** — A clinic has at most one active rep per (facility × vertical). Enforced by the
  partial unique index on `facility_vertical_rep_assignments WHERE ended_at IS NULL`.
- **I2** — A rep may be assigned a clinic only if one of their patches geometrically covers the
  clinic's point **OR** the assignment carries an explicit override (§3.2).
- **I3** — Manager zones of the same vertical do not overlap beyond a floating-point epsilon
  (§3.3).
- **I4** — A patch is fully contained (`ST_CoveredBy`) within exactly one active manager zone
  of the same vertical.
- **I5** — Rep assignment rows are never deleted. Ending an assignment sets `ended_at`.
- **I6** — A user may hold a territory only in a vertical they are assigned (Spec 0010 §V1).

---

## 3. Requirements

### 3.1 Boundary save must be atomic — R1 (S1, must-fix)

**Today:** `territory-boundary.use-cases.ts:132-177` commits `endActiveForProfiles` (:156-159)
*before* `applyTerritoryBoundary` (:163) validates. No transaction exists anywhere in
`apps/api/src/modules/territory` except `drizzle-facility-membership.writer.ts:19`. Validation
failure leaves rep assignments ended with no rollback.

Reachable by splitting a manager zone: straddling child patches make the containment check
throw, so reps are de-assigned *and* the split fails. Retrying loses more.

**Required:**
- Wrap the whole save in `db.transaction`.
- Validate **before** mutating. Order: validate geometry → validate containment → validate
  sibling overlap → recompute impact → end assignments → apply boundary.
- Any validation failure rolls back completely.

**AC:** attempting a zone split that orphans a patch fails with the containment error **and
leaves every rep assignment intact**. Covered by an integration test.

### 3.2 Assignment override — R2

Informal-market reality requires assigning a rep outside their patch. Model it as an override
on the assignment, not as an exception type.

**Schema:** add to `facility_vertical_rep_assignments`:
- `override_reason text NULL`
- `override_by_user_id bigint NULL` → `users.id`

**Behaviour:**
- I2 becomes: patch covers the clinic **OR** `override_reason IS NOT NULL`.
- Overridden assignments are **skipped by de-assignment sweeps** and **excluded from
  boundary-impact sets**. An override that recompute can erase is not an override.
- Overrides are reportable: "how many out-of-territory assignments exist, who approved them,
  why".

**AC:** an overridden assignment survives a boundary edit that would otherwise de-assign it,
and appears in an out-of-territory report.

### 3.3 Zone overlap must be effectively zero — R3

**Today:** `GEO_SIBLING_OVERLAP_BLOCK_RATIO = 0.05` (`territory-geo.constants.ts:2`) permits
same-vertical overlap up to 5% of the proposed polygon's area — square kilometres on a large
zone. This is the reachable path to R4's ambiguity case.

**Required:**
- Replace the ratio with a small **absolute-area epsilon** (order of 1 m²), tolerating
  float noise from hand-drawn borders while rejecting real overlap.
- Add **snap-to-neighbour / shared-vertex** support in the map editor so adjacent zones are
  drawn against each other. A stricter validator without editor support degrades UX badly —
  ship both together.
- Keep the existing vertical scoping: `t.vertical_id = (source vertical)` at
  `drizzle-territory-spatial.repository.ts:342-353` is correct.

**AC:** two same-vertical zones sharing a hand-drawn border save successfully; a 100 m² overlap
is rejected; two different-vertical zones may overlap arbitrarily.

### 3.4 Ambiguity must be loud — R4

**Today:** `resolveVerticalMatches` (`territory-membership.service.ts:188`) sets
`manager_zone_id = NULL` when more than one zone matches — the clinic silently disappears from
**both** managers. A data-integrity violation that hides its own evidence.

**Required:** log at warn with both zone ids, emit a metric, and surface the clinic in the
unassigned queue with a distinct reason (`ambiguous_zone`, not `no_zone`).

**AC:** creating an overlapping-zone condition produces a log line, a metric, and a
distinguishable queue entry.

### 3.5 Location-change choke point — R5

**Today:** four code paths write `facilities.location`; only three trigger membership
recompute, and **none** checks existing assignments.

| Path | Recomputes | Checks assignments |
|---|---|---|
| `POST /facilities` (`facility.use-cases.ts:327-363`) | yes | n/a |
| `PATCH /facilities/:id` (:366-446) | yes | **no** |
| field-suggestion address approval (`field-suggestion-apply.service.ts:104-122`) | yes | **no** |
| `geocode-facilities.ts:260-272` | **no** | no |

Also: **there is no address-edit endpoint** — `PATCH /facilities/:id` accepts only
`lat`/`lng`. And **geocode-on-write is a dead branch**: create/update call
`resolveCoordinates({lat, lng})` with no `address` argument, so
`facility-geocoding.service.ts:356-377` never geocodes.

**Required:**
- One service owns every location/address mutation. Nothing else writes `facilities.location`
  — including scripts.
- It geocodes when an address is supplied without explicit coordinates. Explicit coordinates
  bypass geocoding (so a Mapbox outage cannot block address edits entirely).
- It computes a **coverage delta** and warns only about assignments that would actually become
  invalid. Warning merely because someone is assigned produces alert fatigue and defeats the
  safety it buys.
- Empty delta ⇒ the change proceeds with no prompt.
- Build the address-edit endpoint; extend `PATCH /facilities/:id` to the address fields.

**AC:** moving a clinic 50 m within the same zone and patch prompts nothing; moving it out of
its rep's patch prompts with exactly that assignment listed; `geocode-facilities.ts` recomputes
membership.

### 3.6 Two-phase preview/confirm — R6

Reuse the boundary-impact pattern for R5. Its current shape:
`POST /territories/:id/boundary/impact` → `{mode, clinics[]}`; `PUT .../boundary` accepts
`acceptedFacilityIds`.

**Strengths to keep:** the server **re-computes** the impact set and requires exact set
equality both ways (`assertAcceptedImpactFacilityIds:42-91`) — the client is not trusted, and
TOCTOU fails **closed**.

**Weaknesses to fix while extending it:**
- No version/etag/nonce ⇒ a mismatch gives a generic error with no diff. Return the delta.
- No row lock ⇒ concurrent admins editing one zone interleave.
- Manager-zone recompute is **fire-and-forget** (`territory/composition.ts:55-65`) ⇒ HTTP 200
  does not mean membership is updated. Either make it synchronous or report progress.
- **Impact queries silently skip `f.location IS NULL`**
  (`drizzle-territory-spatial.repository.ts:240,289`) — un-geocoded clinics are invisible to
  the safety mechanism meant to protect them. Include them, flagged.

### 3.7 Remove the admin geo-override — R7

Delete `PATCH /facilities/:id/territory`, `POST /facilities/:id/territory/unlock-geo`, the
`adminOverrideClinicTerritory` / `unlockClinicGeo` use-cases, and the web override dialog.

Zone membership becomes **purely derived, with no exceptions**. Consequently no
`territory_assignment_source` column is needed, and Spec 0003 AC12/AC14 are deleted.

### 3.8 Reps without a patch — R8

A rep with no patch has **no manager** (the hierarchy is patch-derived), appears on no team,
and can hold no clinics. This is accepted as a forcing function for territory upkeep.

To make the forcing function work rather than merely bite, surface a **"reps without an active
patch"** roster where an admin or manager looks. Fold into the team-management screen.

Known costs, accepted: onboarding blocked until a polygon is drawn; no leave/vacation path;
training ride-alongs need a second coincident patch.

### 3.9 Dead-code removal — R9

- `territories.code` — always `slug.toUpperCase()`; sole reader `findByCode` has no callers;
  carries its own unique index. Remove column, index, and reader.
- `user_territory_assignments.assigned_by` — written, never read.
- `reason` in the `PATCH /territories/:id` body — accepted and discarded.
- `managerId` in the `POST /users/:id/verticals` body — dead since `0044`.
- `findManagerIdByUserId` — hardcoded `return null` (`drizzle-scope.repository.ts:136-139`).
- `.github/workflows/prod-cleanup-multi-uta-patches.yml` + `cleanup-legacy-multi-uta-patches.ts`
  + its two `apps/api/package.json` entries. **Confirmed never run in production**, so no
  cloned patches exist to remediate.

Keep `territory_types` for now (2-row catalog) but do not invest in its admin UI.

---

## 4. Deferred

- **Zone split** — patches straddling a new dividing line. Blocked today by the containment
  check; made *safe to fail* by R1. Options when tackled: block until patches are redrawn,
  auto-split patches along the line, or relax containment to overlap. Splitting a manager
  territory is a normal business operation and the model currently makes it hard.
- **Recompute assigning as well as de-assigning** for manager zones. Derived membership makes
  "clinics falling in" free; only rep de-assignment needs confirmation. Today's flow is
  one-way.
- **Shared/temporary rep coverage** — no co-ownership, no holiday cover. One active rep only.
- **Eligibility revalidation** — I2 is checked at assignment time and never again. Editing
  coordinates or shrinking a patch leaves assignments in states that could not be created.

---

## 5. Defects closed

D-01, D-04, D-05, D-18, D-19, D-20, D-21, D-25 (superseded), D-33, D-34, D-39, D-40, D-41.
Partially: D-26, D-27 (deferred above). See `.ai/backlog/2026-08-09-defect-register.md`.

## 6. Out of scope

Web UI (parked — all product work is mobile). CNES registry ingest. Explicit team/manager
links (hierarchy stays territory-derived).
