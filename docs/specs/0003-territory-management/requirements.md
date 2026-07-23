# Spec 0003: Territory Management Requirements

**Status:** Implemented (backend core)  
**Last Updated:** 2026-07-07  
**Authoritative detail:** [Spec 37 — Territory Management](../../../apps/api/specs/37-territory-management.md)

## User Story

As a sales manager, I want to define territories and assign users, clinics, and doctors to them, so that field activity, access control, routing, and analytics reflect real commercial coverage with unambiguous manager scope and optional administrative filters.

## Architecture Summary

The system uses a **dual-graph territory model**:

1. **Assignment graph** — flat **manager zones** contain **rep patches** via `managerTerritoryId` (validated with `ST_CoveredBy` on boundary save). Drives user scope.
2. **Grouping graph** — tree of region/state/municipality types (`participatesInGroupingHierarchy`) for filter navigation and analytics only. Does not drive scope.

Clinics are assigned to rep patches via point-in-polygon on write. Scope resolves with FK lookups — no geo membership index or closure expansion for assignment.

## Acceptance Criteria

### Structure & types

1. WHEN a territory is created THEN the system SHALL associate it with a `TerritoryType` and optional `parentId` according to type rules (grouping types require a parent except country).
2. WHEN a manager zone or rep patch is created THEN the system SHALL NOT require a tree parent.
3. WHEN grouping territories are created or ingested THEN the system SHALL preserve manual tree parents via `parentId` and closure.
4. WHEN Brazil reference geography is ingested (`bun run db:ingest:brazil`) THEN the system SHALL create country → macro-region → state → municipality hierarchy with valid PostGIS boundaries as grouping shapes.

### Boundaries & containment

5. WHEN a rep patch boundary is saved THEN the system SHALL resolve exactly one containing active manager zone and set `managerTerritoryId`.
6. WHEN a rep patch is not fully inside any manager zone, or inside more than one THEN the system SHALL reject the save.
7. WHEN a rep patch or manager zone boundary overlaps another active sibling of the same type THEN the system SHALL reject the save.
8. WHEN reference geography boundaries are saved from IBGE ingestion THEN invalid geometries MAY be repaired with `ST_MakeValid`.

### User assignment & scope

9. WHEN a manager assigns a user to a territory THEN the system SHALL grant access according to role and assignment rules.
10. WHEN scope is resolved THEN `effectiveTerritoryIds` SHALL include directly assigned territories and rep patches linked via `managerTerritoryId` for manager zone assignments. Grouping closure SHALL NOT expand scope.
11. WHEN a territory assignment or `managerTerritoryId` changes THEN the system SHALL invalidate affected Redis scope caches.

### Facility membership

12. WHEN a clinic has coordinates and `territoryAssignmentSource = geo` THEN the system SHALL assign it to the containing active rep patch via `ST_Covers`.
13. WHEN a clinic is assigned to a rep patch THEN access checks SHALL use `Clinic.territoryId`.
14. WHEN a clinic has `territoryAssignmentSource = manual` THEN automatic geo recompute SHALL NOT change its assignment until explicitly unlocked.
15. WHEN a rep patch boundary is updated (PUT boundary) THEN the system SHALL enqueue clinic membership re-evaluation for affected clinics. WHEN a territory is first created (POST) THEN the system SHALL NOT auto-assign clinics or enqueue membership recompute — clinic membership stays unchanged until an explicit recompute or a later boundary edit.

### Coverage analytics

16. WHEN `GET /territories/:id/analytics-view` is called for a grouping territory THEN the system SHALL return clinics in the caller's scoped rep patches whose coordinates fall inside the grouping boundary.
17. WHEN a user lists clinics or doctors THEN the system SHALL filter results by territory scope at the data layer.

### Audit & approvals

18. WHEN a territory assignment or clinic territory override changes THEN the system SHALL audit the change where applicable (approval workflow / admin override).
19. IF a manager has reports but no territory assignment THEN the system SHALL follow the explicit product rule defined in F-008 for manager scope.

## API Surface (implemented)

| Endpoint | Purpose |
|----------|---------|
| `GET/POST /territories` | List / create |
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
