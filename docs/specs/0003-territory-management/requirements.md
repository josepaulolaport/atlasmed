# Spec 0003: Territory Management Requirements

**Status:** Implemented (backend core) + vertical ownership addendum in progress  
**Last Updated:** 2026-07-26  
**Authoritative detail:** [Spec 37 — Territory Management](../../../apps/api/specs/37-territory-management.md)  
**Vertical ownership addendum (accepted):** [vertical-ownership-design.md](./vertical-ownership-design.md)

## User Story

As a sales manager, I want to define territories and assign users, clinics, and doctors to them, so that field activity, access control, routing, and analytics reflect real commercial coverage with unambiguous manager scope and optional administrative filters.

## Architecture Summary

The system uses a **dual-graph territory model**:

1. **Assignment graph** — flat **manager zones** contain **rep patches** via `managerTerritoryId` (validated with `ST_CoveredBy` on boundary save). Drives user scope. Each territory row belongs to **one** `business_verticals` (`territories.vertical_id`). New verticals get new zone/patch rows.
2. **Grouping graph** — tree of region/state/municipality types (`participatesInGroupingHierarchy`) for filter navigation and analytics only. Does not drive scope. Groupings are **never** user-assignable.

Clinics get per-vertical geo membership via point-in-polygon on write/recompute, stored on `facility_vertical_profiles.territory_id`. Scope resolves with FK lookups on that membership (plus legacy `facilities.territoryId` bridge) — not live PIP on every list.

## Acceptance Criteria

### Structure & types

1. WHEN a territory is created THEN the system SHALL associate it with a `TerritoryType` and optional `parentId` according to type rules (grouping types require a parent except country).
2. WHEN a manager zone or rep patch is created THEN the system SHALL NOT require a tree parent.
3. WHEN grouping territories are created or ingested THEN the system SHALL preserve manual tree parents via `parentId` and closure.
4. WHEN Brazil reference geography is ingested (`bun run db:ingest:brazil`) THEN the system SHALL create country → macro-region → state → municipality hierarchy with valid PostGIS boundaries as grouping shapes.

### Boundaries & containment

5. WHEN a rep patch boundary is saved THEN the system SHALL resolve exactly one containing active manager zone **of the same vertical** and set `managerTerritoryId`.
6. WHEN a rep patch is not fully inside any manager zone, or inside more than one THEN the system SHALL reject the save.
7. WHEN a rep patch or manager zone boundary overlaps another active sibling of the same type **and same vertical** THEN the system SHALL reject the save.
8. WHEN reference geography boundaries are saved from IBGE ingestion THEN invalid geometries MAY be repaired with `ST_MakeValid`.

### User assignment & scope

9. WHEN a manager assigns a user to a territory THEN the system SHALL grant access according to role and assignment rules. Multiple REPs MAY share one patch; managers remain exclusive per zone.
10. WHEN scope is resolved THEN `effectiveTerritoryIds` SHALL include directly assigned territories and rep patches linked via `managerTerritoryId` for manager zone assignments. Grouping closure SHALL NOT expand scope.
11. WHEN a territory assignment or `managerTerritoryId` changes THEN the system SHALL invalidate affected Redis scope caches.
11b. WHEN role is REP THEN clinic `facilityIds` SHALL come only from active `facility_consultant_assignments` (patch UTA does not grant clinic list access).
11c. WHEN role is OPS THEN clinic `facilityIds` SHALL be facilities with an active profile in the user’s verticals (no zone cover required).
11d. WHEN role is MANAGER THEN clinic `facilityIds` SHALL be profile membership in oversight zones ∪ own consultant assigns, intersected with active profiles in resolved verticals.

### Facility membership

12. WHEN a clinic has coordinates and `territoryAssignmentSource = geo` THEN the system SHALL, **per vertical**, assign `facility_vertical_profiles.territory_id` to the containing active rep patch of that vertical via `ST_Covers` (0 → clear; >1 in same vertical → ambiguous/clear).
13. WHEN manager geo scope is resolved THEN access checks SHALL use per-vertical membership (`facility_vertical_profiles.territory_id`), not sole reliance on legacy `facilities.territoryId`.
14. WHEN a clinic has `territoryAssignmentSource = manual` THEN automatic geo recompute SHALL NOT change its assignment until explicitly unlocked.
15. WHEN a rep patch boundary changes THEN the system SHALL enqueue clinic membership re-evaluation for affected clinics.

### Coverage analytics

16. WHEN `GET /territories/:id/analytics-view` is called for a grouping territory THEN the system SHALL return clinics in the caller's scoped rep patches whose coordinates fall inside the grouping boundary.
17. WHEN a user lists clinics or doctors THEN the system SHALL filter results by territory scope at the data layer.
17b. WHEN analytics or lists apply an active vertical filter THEN facts SHALL be grain `(facility, vertical)` — coverage in V1 MUST NOT imply coverage in V2 (see vertical-ownership-design Q9).

### Audit & approvals

18. WHEN a territory assignment or clinic territory override changes THEN the system SHALL audit the change where applicable (approval workflow / admin override).
19. IF a manager has reports but no territory assignment THEN the system SHALL follow the explicit product rule defined in F-008 for manager scope.

## API Surface (implemented)

| Endpoint | Purpose |
|----------|---------|
| `GET/POST /territories` | List / create (`verticalId` required on create; optional `?verticalId=` on list) |
| `GET /territories/grouping-tree` | Grouping hierarchy for filter UI |
| `PUT /territories/:id/boundary` | Save boundary (role-based post-save flow) |
| `GET /territories/:id/analytics-view` | Scoped clinics inside grouping shape |
| `POST /territories/recompute-membership` | Admin force clinic geo recompute |

**Removed:** `geo-memberships`, `operational-members`, `coverage-view`, `ambiguous-parents`, `rollup-links`.

See Spec 37 for the full endpoint table and design detail.

## Out of scope (deferred)

- Web analytics map UI — API ready
- Order/visit territory snapshot fields (Spec 06 / 11)
- `POST /territories/:id/split`
- Shared geographic coverage with clinic-level ownership (multiple reps in the same neighborhood) — see [Spec 0006](../0006-shared-territory-clinic-ownership/requirements.md)
