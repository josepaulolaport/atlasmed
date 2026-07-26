# Spec 0003 addendum: Territory ownership × business verticals (P1 design)

**Status:** Accepted (product decisions locked 2026-07-26)  
**Created:** 2026-07-25  
**Depends on:** Business Verticals P0 ([`business-verticals.md`](../../architecture/features/business-verticals.md)), Spec 0003 requirements, Spec 0006 (shared coverage — related but distinct)  
**Out of this doc:** Dermatologia seed, product catalog filtering, assignment history windows (P2)  
**Engineering locks (impl):** membership = `facility_vertical_profiles.territory_id`; `territories.vertical_id` NOT NULL; slug/code unique per vertical. Legacy `facilities.territoryId` kept as bridge (Ortopedia sync) until cutover.  
**Clarified:** REP patch UTA kept; multi-REP per patch OK; clinic visibility still consultant-only (Q2/Q4)

---

## 1. Problem

After P0:

- Territory **geometry** is global (no `territories.sector_id`).
- Facility **commercial** data is per-vertical (`facility_vertical_profiles`).
- Direct clinic ownership is per-vertical (`facility_consultant_assignments.vertical_id`, one active REP per facility×vertical).
- Live user↔territory assignment is still **`UNIQUE (user_id, territory_id)`** — **no vertical**.

So a REP’s patches apply to **all** their verticals at once. That is wrong once Dermatologia (or a second vertical) shares the same map:

- Manager zone / rep patch drawn once for SP should not force “whoever owns the patch owns every vertical.”
- Invite staging already models **territories under a vertical** (`invitation_territory_assignments.vertical_id`); live assignments do not.

P0 scope = territory ∪ consultant facilities **∩** profiles in resolved verticals. Territory side still over-shares patches across verticals.

---

## 2. Goals

1. Keep Spec 0003 zone → patch tree shape, but **rows are per vertical** (Q5).
2. Store clinic↔patch membership **per vertical** for cheap scope reads (Q6 C).
3. Define precedence: consultant assign (REP) vs geo membership (MANAGER coverage).
4. Align live APIs with invite-shaped **per-vertical territory lists**.
5. Stay compatible with P0 facility visibility (unprofiled = ADMIN-only; one REP per facility×vertical).

## 3. Non-goals

- Parallel apps / separate map products per vertical.
- Live point-in-polygon on every list/scope request (Q6 rejected D).
- Spec 0006 full “shared overlapping rep patches + clinic-only ownership” rewrite (related; after this addendum).
- Assignment history / validity windows (P2).
- Redesigning IBGE grouping ingestion or map drawing tools.

---

## 4. Proposed model (working)

### 4.1 Layers (revised after Q3/Q5)

| Layer | Role |
|---|---|
| `territories` + types | Geometry **per vertical** — new vertical ⇒ **new zone/patch rows** (Q5 D), not one shared polygon with multi-vertical assigns |
| Territory ↔ vertical | Territory belongs to **one** vertical (`territories.vertical_id` candidate) |
| Clinic ↔ patch membership | **Per vertical** (Q6 **C**) — not a single global `facilities.territoryId` for access. Store membership (join / profile FK); PIP only on write/recompute |
| `facility_vertical_profiles` | Clinic participates commercially in a vertical |
| `facility_consultant_assignments` | Authoritative **clinic×vertical** REP (manual; one per pair) |
| `user_territory_assignments` | User ↔ territory row (territory already implies vertical). **MANAGER and REP** both get UTA. **Many REPs per patch** allowed (Q2). Q1: same user cannot hold same territory in two verticals — satisfied if territory has one vertical |

### 4.2 Schema direction (candidate — revise vs early draft)

Early draft put `vertical_id` only on UTA with shared geometry. **Q5 D rejects that** for zones.

Candidate instead:

```text
territories.vertical_id  NOT NULL  -- FK business_verticals; one vertical per territory row
user_territory_assignments stays UNIQUE (user_id, territory_id)
-- invite territory picks are already per-vertical; they select territory rows of that vertical
```

Ortopedia backfill: existing territories → Ortopedia. New vertical → create new zone/patch rows (copy geometry optional later; product = recreate).

### 4.2b Clinic membership (locked Q6 **C**)

Single `facilities.territoryId` cannot express “in Ortopedia patch A **and** Dermatologia patch B.”

**Locked:** per-vertical membership stored for reads (FK / join). Candidates:

- `facility_vertical_profiles.territory_id` (membership lives with commercial profile), or
- `facility_territory_memberships (facility_id, territory_id)` with territory already carrying `vertical_id`

PIP / polygon cover runs on **assign or recompute** (zone edit, facility move), **not** on every list/scope resolve. Manager geo scope stays `findIdsByTerritoryIds`-shaped (cheap).

Legacy `facilities.territoryId` may remain display/migration bridge until cutover; access must not depend on it alone after dual-vertical.

### 4.3 Scope algorithm (locked direction from Q4–Q4c)

**REP** (`resolvedVerticalIds`):

```text
facilityIds = active consultant assigns for self
              WHERE vertical_id IN resolvedVerticalIds
              ∩ facilities with active profile in those verticals
```

**REP patch UTA still exists** (org / map / routing / “my patches”) and **multiple REPs may share a patch**. Geo UTA **does not** add clinics to REP facility scope — clinics only via consultant (Q4).

**MANAGER**:

```text
facilityIds_geo = clinics with stored membership in manager's zones
                  (per-vertical membership — Q6 C)
                  WHERE manager has that vertical
facilityIds = (facilityIds_geo ∪ own consultant assigns)
              ∩ active profiles in resolvedVerticalIds
```

Unassigned (no consultant): still visible to covering manager+vertical (Q4b).

**OPS**:

```text
facilityIds = facilities with active profile in resolvedVerticalIds
```

(No zone cover required — Q4c.)

**ADMIN:** global; optional `verticalId` profile filter (P0).

### 4.5 Manager zones

**Locked (Q3):** zones are **individual to their vertical**. Manager may own **one or more zones** across **one or more verticals** via UTA to those territory rows (vertical implied by `territories.vertical_id`). Oversight expansion stays Spec 0003, filtered to those zone rows.

### 4.6 Same place, two verticals

**Q5 D:** two territory rows (may share similar drawn geometry). **Different users** across those rows — expected. Q1: same user cannot hold both if they were the “same” patch identity across verticals — enforced by separate rows + product rules on assign UI.

```text
Centro (Ortopedia territory)     → REP A / Manager M1
Centro (Dermatologia territory)  → REP B / Manager M2
```

Clinic may hold **two memberships** (Q6 C), one per vertical patch.

---

## 5. API / UX deltas (sketch)

| Surface | Change |
|---|---|
| `PUT /access/users/:id/assignments` | `verticalAssignments[]` selects territory rows of that vertical (vertical via territory FK) |
| Territory list for invite pickers | Keep `?verticalId=` — return only territories of that vertical |
| Scope cache | Invalidate on UTA / membership recompute; key must include vertical set |
| Mobile/web territory assign UI | Per-vertical zone/patch lists; groupings never assignable (Q8) |
| Facility detail “territory” label | Per active vertical: membership patch name; commercial owner from consultant×vertical |

No vertical id in URL paths (verticals P0 rule).

---

## 6. Relation to Spec 0006

| Spec 0006 | This addendum |
|---|---|
| Same **vertical**, overlapping geo, many clinics, many REPs | Same **geo**, **different verticals**, clear owners |
| Questions exclusive sibling patches | Assumes Spec 0003 exclusive patches still OK for P1 |

**Recommended sequence (locked Q7 A):** this territory×vertical addendum **before** Dermatologia seed; Spec 0006 overlap rewrite still later / separate. Dermatologia gets its own zone/patch rows (Q5), not shared Ortopedia geometry.

---

## 7. Migration sketch

1. Add `territories.vertical_id`; backfill existing → Ortopedia.
2. Introduce per-vertical clinic membership (profile FK or membership table); backfill from `facilities.territoryId` for Ortopedia.
3. Scope ports read membership, not sole reliance on `facilities.territoryId`.
4. Create Dermatologia (etc.) zone/patch rows when that vertical ships; recompute membership for those polygons.
5. Cut over / drop legacy single-FK access path when dual-vertical is live.

---

## 8. Product decisions (locked)

| # | Question | Options / notes |
|---|---|---|
| **Q1** | May the **same user** hold the **same patch** in **multiple verticals**? | **Locked: B — no.** A user may hold a given patch in only one vertical. |
| **Q2** | How many REPs per `(patch, vertical)`? | **Locked: B — zero or more.** REPs **still receive patch UTA** (patches remain assignable). Many REPs on same patch OK. Patch UTA does **not** grant REP clinic list access — clinics via **manual consultant** only (Q4). **Manager** zone UTA **does** bind geo coverage for manager scope. Spec 0006 (richer shared-coverage) still later. |
| **Q3** | Managers: zone assignment **per vertical** or vertical-agnostic? | **Locked: A + product wording.** Zones are **individual to their vertical**. A manager may own **one or more zones** in **one or more verticals**. Not vertical-agnostic (B). |
| **Q4** | REP clinic visibility vs territory / consultant | **Locked: D (product).** REPs see a clinic **only** via **manual** `facility_consultant_assignments` for a vertical they have. **One REP per (clinic, vertical).** Geo patch assignment does **not** grant REP clinic visibility. |
| **Q4b** | Clinic with profile, **no** consultant yet | **Locked: B + vertical.** **MANAGER** whose **zone covers** the clinic **and** who belongs to that clinic’s vertical; plus **ADMIN**. REPs still only via consultant. |
| **Q4c** | OPS sees unassigned (no consultant) profiled clinic? | **Locked: B.** Yes if OPS has that vertical (no zone cover required). |
| **Q5** | New vertical vs existing Ortopedia zones | **Locked: D.** Zones are **recreated per vertical** (new territory rows), not copied assigns onto shared geometry. Dermatologia gets its own zone/patch entities. |
| **Q6** | Clinic geo membership when zones are per-vertical | **Locked: C.** Per-vertical membership stored (profile FK or membership table). PIP on write/recompute only — not live PIP for access (rejected D for hot path). |
| **Q7** | Dermatologia vs territory addendum sequencing | **Locked: A.** Territory addendum first (per-vertical zones + membership); Dermatologia after. Not together (B); not Dermatologia-first on shared patches (C). |
| **Q8** | Grouping territories (IBGE): assignable? | **Locked: A.** Never assignable — graph/org only. Only manager zones + rep patches get UTA. |
| **Q9** | Analytics grain vs multi-vertical coverage | **Locked: A + anti false-positive.** Same vertical filter as list APIs. Fact grain = `(facility, vertical)`. Never imply coverage in V2 because clinic is covered in V1. |

### Q9 — Analytics anti false-positive (how)

**Unit of truth:** commercial coverage is `(facility F, vertical V)`, not building F alone.

A clinic enters a vertical’s analytics **only if all** hold for that V:

1. Active `facility_vertical_profiles` for V  
2. In-scope for the viewer for V (MANAGER: stored membership in their V zones ∪ own consultant; REP: consultant only; OPS: profile in V; ADMIN: global + filter)  
3. Metrics that need a consultant (e.g. “assigned”) use `facility_consultant_assignments` for **that same V** — not another vertical’s assign

| Situation | Ortopedia filter | Dermatologia filter |
|---|---|---|
| Profile + membership only Ortopedia | counts | **must not** count |
| Profile both; manager zone only Ortopedia | counts (if in scope) | **must not** (no Derm membership / zone) |
| Profile both; zones both; consultant only Ortopedia | in geo KPIs; “has consultor” yes | in geo KPIs; “has consultor” **no** |

**All-verticals view:** series **per vertical** (or labeled profile counts). No silent global clinic dedupe that hides “covered in one vertical, not the other.”

**Implementation sketch:** analytics queries join/filter on `vertical_id` the same way list scope does; reuse scope facility ids **already resolved for the active vertical set** — do not start from bare `facilities.id` then attach any vertical.

---

## 9. Acceptance criteria

1. WHEN a user is assigned territory T of vertical V1 only THEN scope for V2 SHALL NOT include T’s geo clinics from that row.
2. WHEN clinic F has membership/profile for V1 but not V2 THEN analytics/list for V2 SHALL NOT include F (no cross-vertical false positive).
3. WHEN an active consultant assign exists for (F, V) THEN the responsible REP for (F,V) SHALL be that assignee; territory display uses per-vertical membership patch name.
4. WHEN consultant rules apply THEN visibility SHALL follow §8 Q4–Q4c (REP consultant-only; MANAGER zone∪consultant; OPS profile-in-vertical).
5. WHEN invite territory picks are accepted THEN live UTA points at territory rows of that vertical.
6. WHEN Ortopedia historical territories/membership migrate THEN Ortopedia scope SHALL be preserved; new verticals start empty until zones + membership exist.
7. WHEN analytics active vertical = V THEN rollups SHALL use only `(facility, V)` facts in scope for V (Q9).
8. WHEN two REPs share the same patch UTA THEN both MAY keep that assignment; neither SHALL gain clinic list access from the patch alone.
9. WHEN a REP has patch UTA but no consultant row for clinic F THEN F SHALL NOT appear in that REP’s facility scope.

---

## 10. Suggested next steps

1. Tasks PR: `territories.vertical_id` → per-vertical membership → ScopeResolver → invite/manage-assign UI → analytics joins → tests.
2. Align Spec 0003 requirements text with this addendum (FK membership after write-time PIP; per-vertical rows).
3. Dermatologia seed only after this addendum ships (Q7 A).

---

## 11. File index

| Area | Path |
|---|---|
| Territory schema | `packages/database/src/schema/public/territories.ts` |
| Invite territory staging | `packages/database/src/schema/public/invitation-assignments.ts` |
| Scope resolver | `apps/api/src/modules/access/application/services/scope-resolver.service.ts` |
| Verticals decisions | `docs/architecture/features/business-verticals.md` |
| Shared coverage (later) | `docs/specs/0006-shared-territory-clinic-ownership/requirements.md` |
