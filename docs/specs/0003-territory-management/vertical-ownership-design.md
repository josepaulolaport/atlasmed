# Spec 0003 addendum: Territory ownership × business verticals (P1 design draft)

**Status:** Draft — decisions open (see §8)  
**Created:** 2026-07-25  
**Depends on:** Business Verticals P0 ([`business-verticals.md`](../../architecture/features/business-verticals.md)), Spec 0003 requirements, Spec 0006 (shared coverage — related but distinct)  
**Out of this doc:** Dermatologia seed, product catalog filtering, assignment history windows (P2)

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

1. Keep polygons / manager-zone → rep-patch tree as **global geo** (Spec 0003 structure).
2. Make **who owns a patch for sales** an assignment **× vertical**.
3. Define **override precedence** between geo-territory membership and per-vertical consultant assign (locked intent from verticals doc; needs precise rules).
4. Align live APIs with invite-shaped **per-vertical territory lists**.
5. Stay compatible with P0 facility visibility (unprofiled = ADMIN-only; one REP per facility×vertical).

## 3. Non-goals

- Parallel territory tables / apps per vertical.
- Putting a single `vertical_id` owner column back on `territories`.
- Spec 0006 full “shared overlapping rep patches + clinic-only ownership” rewrite (related; sequence TBD — §8 Q7).
- Assignment history / validity windows (P2).
- Redesigning IBGE grouping ingestion or map drawing tools.

---

## 4. Proposed model (working)

### 4.1 Layers (unchanged vs P0)

| Layer | Role |
|---|---|
| `territories` + types | Global geometry; manager zone contains rep patch |
| `facilities.territoryId` | Global geo membership (point-in-polygon); **not** commercial owner |
| `facility_vertical_profiles` | Clinic participates commercially in a vertical |
| `facility_consultant_assignments` | Authoritative **clinic×vertical** REP (P0) |
| `user_territory_assignments` | **Change:** which user covers which patch **for which vertical** |

### 4.2 Schema direction (candidate)

Extend live assignments to match invite staging:

```text
user_territory_assignments
  user_id
  territory_id
  vertical_id          -- NEW, FK business_verticals, NOT NULL after backfill
  assigned_by
  timestamps

UNIQUE (user_id, territory_id, vertical_id)
-- plus product rule: at most one REP assignee per (territory_id, vertical_id)?  → OPEN (§8 Q2)
```

Migration: existing rows → Ortopedia `vertical_id` (same pattern as P0 consultant/profile backfill).

Invite/`replace` assignments already send `verticalAssignments[].territoryIds` — persist into the new unique key.

### 4.3 Scope algorithm (candidate)

For OPS / MANAGER / REP with `resolvedVerticalIds`:

```text
1. Load user_territory_assignments WHERE vertical_id IN resolvedVerticalIds
2. Expand manager zones → patches (Spec 0003 effectiveTerritoryIds rules) per those rows
3. facilityIds_geo = facilities in those patches (via territoryId / existing ports)
4. facilityIds_direct = active consultant assigns WHERE vertical_id IN resolvedVerticalIds
5. facilityIds_raw = union(geo, direct)
6. facilityIds = intersect(facilityIds_raw, active profiles in resolvedVerticalIds)
```

ADMIN: unchanged global; optional `verticalId` filter on profiles (P0).

### 4.4 Override precedence (candidate — needs product lock)

| Situation | Visibility (list/map) | “Responsible REP” display |
|---|---|---|
| Clinic in REP A’s patch (vertical V), no consultant row | A sees clinic (if profile V) | A (or “território”) |
| Clinic in REP A’s patch, consultant = REP B for V | **B** sees clinic; A? → OPEN (§8 Q4) | B |
| Clinic in no patch, consultant = B for V | B sees clinic | B |
| Profile missing for V | Neither (ADMIN only) | n/a |

Intent from verticals testing bar: *direct assignment overrides territory only inside that vertical.*

### 4.5 Manager zones

**Candidate:** managers also get `user_territory_assignments` with `vertical_id` (zone ids). Oversight expansion stays Spec 0003, filtered by vertical.

Alternative: managers stay vertical-agnostic on zones; only REP patches are vertical-scoped — weaker, probably wrong for multi-vertical managers.

### 4.6 Same patch, two verticals

Allowed and expected:

```text
Patch Centro
├── Ortopedia  → REP A (and/or Manager M1)
└── Dermatologia → REP B (and/or Manager M2)
```

Same as clinic×vertical multi-REP: different commercial ownership, shared geometry.

---

## 5. API / UX deltas (sketch)

| Surface | Change |
|---|---|
| `PUT /access/users/:id/assignments` | Already `verticalAssignments[]` — write `vertical_id` on UTA |
| Territory list for invite pickers | Keep `?verticalId=` (or manager+vertical) |
| Scope cache | Invalidate on UTA change; key must include vertical set |
| Mobile/web territory assign UI | Per-vertical patch lists (invite already close); live manage must match |
| Facility detail “territory” label | Still geo patch name (global); commercial owner from consultant×vertical |

No vertical id in URL paths (verticals P0 rule).

---

## 6. Relation to Spec 0006

| Spec 0006 | This addendum |
|---|---|
| Same **vertical**, overlapping geo, many clinics, many REPs | Same **geo**, **different verticals**, clear owners |
| Questions exclusive sibling patches | Assumes Spec 0003 exclusive patches still OK for P1 |

**Recommended sequence (proposal):** ship this vertical×assignment addendum **before** Spec 0006 overlap rewrite. Dermatologia can share polygons with Ortopedia under exclusive patches; Spec 0006 still needed if two Ortopedia REPs must share a bairro.

---

## 7. Migration sketch

1. Add nullable `vertical_id` on `user_territory_assignments`.
2. Backfill Ortopedia.
3. Set NOT NULL; drop old unique `(user_id, territory_id)`; add new unique.
4. Deploy API that reads/writes vertical-aware UTA.
5. Re-invite / admin audit: users with multiple verticals but patches only on Ortopedia — product decides copy vs blank Dermatologia (§8 Q5).

---

## 8. Open questions (need answers)

| # | Question | Options / notes |
|---|---|---|
| **Q1** | May the **same user** hold the **same patch** in **multiple verticals**? | Default lean: **yes** |
| **Q2** | At most **one REP** per `(territory_id, vertical_id)`? | Lean: **yes** for exclusive-patch world; Spec 0006 may relax later |
| **Q3** | Managers: zone assignment **per vertical** or vertical-agnostic? | Lean: **per vertical** |
| **Q4** | When consultant B overrides patch owned by A (same vertical): does A still **see** the clinic? | Lean: **no** (override removes geo visibility for A); or soft “coverage without ownership” |
| **Q5** | Multi-vertical user with patches only backfilled to Ortopedia: auto-copy patches to new verticals on Dermatologia seed, or blank until assigned? | Lean: **blank** (explicit assign) |
| **Q6** | Does `facilities.territoryId` stay **single global** geo FK forever in this design? | Lean: **yes** |
| **Q7** | Ship Dermatologia **before** this territory addendum (rely on consultant + shared patches), or **block** Dermatologia until UTA has `vertical_id`? | Lean: territory addendum **before** or **with** Dermatologia — not after silent production dual-vertical |
| **Q8** | Grouping territories (IBGE): assignable to users per vertical, or never? | Lean: **never** (assignment graph only) — confirm |
| **Q9** | Analytics rollups: count clinic once per vertical when manager has multi-vertical zones? | Lean: **per active vertical filter / union rules** same as list APIs |

---

## 9. Acceptance criteria (draft — refine after §8)

1. WHEN a user is assigned patch T only for vertical V1 THEN scope for V2 SHALL NOT include T’s geo clinics solely from that row.
2. WHEN the same patch T is assigned to REP A for V1 and REP B for V2 THEN each SHALL see profiled clinics in T only for their vertical (modulo consultant override).
3. WHEN an active consultant assign exists for (facility F, vertical V) THEN the responsible REP for (F,V) SHALL be that assignee; territory display MAY still show geo patch name.
4. WHEN consultant override applies THEN visibility SHALL follow the locked override rule from §8 Q4.
5. WHEN invite `verticalAssignments` are accepted THEN live UTA rows SHALL carry the same `vertical_id` as staged.
6. WHEN Ortopedia-only historical UTA is migrated THEN every row SHALL receive Ortopedia `vertical_id` and users SHALL not lose Ortopedia geo scope.

---

## 10. Suggested next steps

1. Answer §8 (product).
2. Promote this draft → accepted design; update Spec 0003 requirements + context-map.
3. Tasks PR: schema → ScopeResolver → invite accept path → mobile/web manage-assign → tests.
4. Sequence vs Dermatologia seed per Q7.

---

## 11. File index

| Area | Path |
|---|---|
| Territory schema | `packages/database/src/schema/public/territories.ts` |
| Invite territory staging | `packages/database/src/schema/public/invitation-assignments.ts` |
| Scope resolver | `apps/api/src/modules/access/application/services/scope-resolver.service.ts` |
| Verticals decisions | `docs/architecture/features/business-verticals.md` |
| Shared coverage (later) | `docs/specs/0006-shared-territory-clinic-ownership/requirements.md` |
