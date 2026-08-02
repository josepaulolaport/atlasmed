# Spec 0006: Shared Territory Coverage & Clinic-Level Ownership

**Status:** Accepted (product decisions locked 2026-08-01)  
**Created:** 2026-07-22  
**Updated:** 2026-08-02  
**Related:** [Spec 0003 — Territory Management](../0003-territory-management/requirements.md), [vertical-ownership-design.md](../0003-territory-management/vertical-ownership-design.md)

## User Story

As a sales manager, I want multiple representatives to operate in the same geographic neighborhood while each remains clearly responsible for different clinics, so that territory maps stay manageable and access, reporting, routing, and reassignment reflect real commercial ownership—not artificial micro-polygons.

## Principle

> **Territories determine coverage and eligibility. Clinic assignments determine responsibility.**

```text
Manager zone     = market / oversight bin (exclusive)
Rep patch        = where that one rep works (may overlap other rep patches)
Clinic owner     = commercial responsibility (manual primary)
Clinic address   = human location on clinic page (not a rep-patch FK)
```

## Locked model

### Layer rules

| Layer | Rule |
|---|---|
| Manager zone | Non-overlapping; **1 manager** (1×1 UTA) |
| Rep patch | **Overlap allowed** with sibling patches; **1 rep per patch**; many patches per rep; each patch is that rep’s shape |
| Patch containment | Patch must remain `ST_CoveredBy` its manager zone |
| UTA | One active user assignment per patch (rep); manager UTA on zone |
| Clinic geo membership | `facility_vertical_profiles.manager_zone_id` → **manager zone** (renamed from `territory_id`) |
| Clinic ownership | `facility_consultant_assignments` — one active primary per facility×vertical |
| Assignment mode | **MANUAL only** |
| Assign eligibility | **Restricted**: assignee must have a patch covering the clinic point; if none → cannot assign |
| Who edits zones | **ADMIN only** (create/update/delete manager zones) |
| Who edits patches | **ADMIN + MANAGER** (manager: patches under own zones only) |
| REP ↔ manager link | **Territory-derived only** — not `users.manager_id`. REP may have patches under **different** managers’ zones (multi-manager by territory). |
| REP clinic visibility | Own owned clinics only |
| Manager clinic visibility | Clinics with `manager_zone_id` in oversight zones ∪ own consultant assigns (includes unassigned in zone) |

### Manager derivation (locked 2026-08-02)

```text
REP → patch UTA → patch.manager_territory_id → zone → zone UTA → Manager
Clinic gerente → manager_zone_id → zone → zone UTA → Manager
```

- Dropped columns: `users.manager_id`, `user_vertical_assignments.manager_id`, `invitations.manager_id`, `invitation_vertical_assignments.manager_id`.
- Invite (mobile + API): pick **manager zone** → empty patch (or `newPatch` draft). Accept assigns UTA only; manager link = zone UTA.
- `managedUserIds` = distinct REPs with patch UTA under manager’s zones — **not** `WHERE manager_id = me`. Prefer SQL predicates long-term; do not grow giant id dumps for clinics.
- Removed `PATCH /users/:id/manager`. Assignments replace is territory/vertical only.

### Scope

| Role | Cached in scope | Clinic access |
|---|---|---|
| REP | Consultant-derived (or equivalent) | Active `facility_consultant_assignments` ∩ verticals |
| MANAGER | **`oversightZoneIds`** (+ verticals; optional derived team ids) | SQL: `manager_zone_id IN oversightZoneIds` OR own consultant assign — **do not** materialize all clinic ids for geo |
| OPS / ADMIN | Unchanged idea | Vertical / global |

### Boundary edit flow (zone and patch)

1. User draws new geometry — **not applied yet**
2. System computes **impact** — only clinics that **currently have a primary rep assigned**
3. Impacts:
   - **Zone edit:** assigned clinic would leave the zone ⇒ requires deassign
   - **Rep patch edit:** clinic owned by that patch’s rep would no longer be covered by any of that rep’s patches ⇒ requires deassign
4. User must **accept deassign for every listed clinic**, or **cancel** the entire edit
5. On confirm: end accepted consultant rows + save geometry + recompute `manager_zone_id` when zone geometry changed
6. Unassigned clinics are not in the impact list; membership updates after save without deassign prompts

### Membership recompute triggers

| Event | Recompute `manager_zone_id`? |
|---|---|
| Manager zone boundary saved (after impact accept) | Yes |
| Clinic lat/lng changed / created | Yes (that clinic) |
| Rep patch boundary saved | No (zone membership unchanged) |

PIP for membership targets **manager zones** (non-overlapping), not rep patches.

## Example

```text
Zone: Zona Oeste
Ana patch:    full Barra
Bruno patch:  full Barra (overlaps Ana — separate shape)
Carlos patch: início Barra + Recreio (overlaps)

Clinics: manager_zone_id = Zona Oeste
Ownership: manager assigns only to a rep whose patch covers the point
```

## Phase 1 scope

**In:** backend model + APIs; mobile geography map; per-rep patch edit (mgr/admin); assign/unassign with restricted eligibility; boundary impact + per-clinic accept deassign; unassigned-in-zone for manager; scope zone-id predicates.

**Out:** web UI (deferred indefinitely for this effort — mobile only); secondary/specialist owners; auto assignment modes; rich manager portfolio UI; rendering all overlapping rep patches at once.

### Phase 1 checklist

| Item | Status |
|---|---|
| Overlapping rep patches + 1 UTA/patch + zone exclusivity | Done |
| `manager_zone_id` membership + migration `0043` | Done |
| Manager scope `oversightZoneIds` | Done |
| Restricted consultant assign + unassign | Done |
| Boundary impact + acceptedFacilityIds | Done |
| Mobile geography (zone underlay + one-rep filter) | Done |
| Mobile patch overlap + impact per-clinic accept | Done |
| Mobile assign/unassign on clinic detail | Done |
| Unassigned-in-zone list (API + mobile) | Done |
| Legacy multi-UTA cleanup script | Done (`cleanup-legacy-multi-uta-patches.ts`) |

## Phase 1 API surface (boundary + ownership)

| Method | Path | Notes |
|---|---|---|
| `POST` | `/territories/:id/boundary/impact` | Proposed GeoJSON → `{ mode, clinics[] }` (assigned clinics needing deassign) |
| `PUT` | `/territories/:id/boundary` | GeoJSON + optional `acceptedFacilityIds` (exact set required when impact non-empty) |
| `GET` | `/territories/unassigned-facilities` | Clinics in oversight zones with no active consultant (`managerZoneId` filter optional) |
| `POST` | `/facilities/:id/consultant-assignments` | Restricted: assignee must have covering rep patch |
| `DELETE` | `/facilities/:id/consultant-assignments/current` | Manual unassign (`endReason: manual_unassign`) |

## Migration

1. Enforce 1 UTA per patch going forward; one-time cleanup of legacy multi-REP UTAs on the same patch (duplicate geometry per rep or drop extras).
2. Rename `facility_vertical_profiles.territory_id` → `manager_zone_id`.
3. Recompute membership: PIP against manager zones.
4. Relax sibling overlap for **rep patches only**; keep non-overlap for manager zones.
5. Manager scope stops expanding zone→patches to collect clinic id lists.

### Production deploy order

Deploy pipeline runs `bun run db:migrate` (applies `0043` + `0044` automatically). Migrations do **not** require a pre-script to succeed.

**Required data script (product correctness, not DDL):** legacy Spec 0003 allowed multiple REPs on one patch. Spec 0006 needs 1 UTA/patch. Run against prod `DATABASE_URL` around deploy (before or immediately after migrate):

```bash
# Dry-run (safe)
cd apps/api && DATABASE_URL=<prod> bun run db:cleanup:multi-uta-patches

# Apply (duplicates geometry per extra REP, moves their UTA)
cd apps/api && DATABASE_URL=<prod> bun run db:cleanup:multi-uta-patches:apply
```

`0044` drops `manager_id` columns — hard cut. Ship API + mobile + web invite clients in the same release window; no dual-read.

`0043` remaps profile membership patch→parent zone when `manager_territory_id` is set; leftover patch pointers are cleared to `NULL` (recompute via zone boundary save / PIP later).

## Spec 0003 deltas

See [requirements.md](../0003-territory-management/requirements.md) § Spec 0006 overrides. In particular:

- AC7 (sibling non-overlap) no longer applies to **rep patches** (still applies to manager zones).
- AC9 multi-REP per patch → **one REP per patch**.
- AC12 membership → containing **manager zone**, not rep patch.
- AC11b REP clinic visibility unchanged (consultant only).

## Acceptance criteria

1. WHEN two reps work the same neighborhood THEN the system SHALL allow overlapping rep patch polygons without requiring micro-splits.
2. WHEN a clinic has an active consultant assignment THEN that assignment SHALL be the source of truth for REP clinic access and commercial ownership.
3. WHEN a manager lists clinics THEN visibility SHALL use `manager_zone_id` (and own assigns), not unique rep-patch membership.
4. WHEN assigning a consultant THEN the system SHALL require the assignee to have at least one patch covering the clinic point (ADMIN same rule in phase 1).
5. WHEN a point falls under zero covering patches THEN assign SHALL be rejected until coverage exists.
6. WHEN editing a zone or patch boundary THEN the system SHALL preview impact for assigned clinics only and SHALL require accept-all deassigns or cancel before saving geometry.
7. WHEN a zone boundary is saved THEN clinic `manager_zone_id` SHALL be recomputed; ownership SHALL change only via accepted deassigns in the impact flow.
8. WHEN scope is resolved for a manager THEN the system SHALL cache oversight zone ids and authorize via SQL predicates — not a full materialization of every clinic id in the zone for geo.
9. WHEN analytics count clinics in a manager zone THEN each clinic SHALL be counted once via `manager_zone_id`.

## Out of scope until later phases

- Web territory / assign UI
- Secondary clinic owners
- Auto territory assignment policies
- Manager “team portfolio” map modes
- Simultaneous render of all overlapping rep patches
