# Spec 0003: Territory Management Requirements

**Status:** Implemented (backend core)  
**Last Updated:** 2026-06-19  
**Authoritative detail:** [Spec 37 — Territory Management](../../../apps/api/specs/37-territory-management.md)

## User Story

As a sales manager, I want to define territories and assign users, clinics, and doctors to them, so that field activity, access control, routing, and analytics reflect real commercial coverage — including patches that span multiple states or municipalities.

## Architecture Summary

The system uses a **dual-layer territory model**:

1. **Reference geography** (`country`, `region`, `state`, `intermediate`) — IBGE-aligned administrative boundaries with a manual parent tree.
2. **Operational patches** (`patch`) — sales territories with full boundaries; clinics are assigned to patches via point-in-polygon.

**Geo membership** (`territory_geo_membership`) automatically records which states and municipalities each patch intersects. User scope expands through the closure table **and** geo membership links.

## Acceptance Criteria

### Structure & types

1. WHEN a territory is created THEN the system SHALL associate it with a `TerritoryType` and optional `parentId` according to type rules.
2. WHEN an operational patch is created without an explicit parent THEN the system SHALL default its parent to the active country territory for the given `countryCode`.
3. WHEN reference geography territories are created or ingested THEN the system SHALL preserve manual tree parents and SHALL NOT auto-reparent from boundary geometry.
4. WHEN Brazil reference geography is ingested (`bun run db:ingest:brazil`) THEN the system SHALL create country → macro-region → state → municipality hierarchy with valid PostGIS boundaries.

### Boundaries & geo membership

5. WHEN a patch boundary is saved THEN the system SHALL rebuild `territory_geo_membership` rows against all `state` and `intermediate` territories in the same country using PostGIS intersection.
6. WHEN a geo membership row is stored THEN `overlapRatio` SHALL be at least 1% of the patch area (`GEO_MEMBERSHIP_MIN_OVERLAP_RATIO`).
7. WHEN a patch boundary overlaps another active sibling patch THEN the system SHALL reject the save.
8. WHEN reference geography boundaries are saved from IBGE ingestion THEN invalid geometries MAY be repaired with `ST_MakeValid`.

### User assignment & scope

9. WHEN a manager assigns a user to a territory THEN the system SHALL grant access according to role and assignment rules.
10. WHEN scope is resolved THEN `effectiveTerritoryIds` SHALL include closure descendants of assigned territories AND operational patches linked via geo membership to assigned reference territories.
11. WHEN a territory assignment changes THEN the system SHALL invalidate affected Redis scope caches.

### Facility membership

12. WHEN a clinic has coordinates and `territoryAssignmentSource = geo` THEN the system SHALL assign it to the containing active patch via `ST_Covers`.
13. WHEN a clinic is assigned to a patch THEN access checks and coverage analytics SHALL use `Clinic.territoryId`.
14. WHEN a clinic has `territoryAssignmentSource = manual` THEN automatic geo recompute SHALL NOT change its assignment until explicitly unlocked.
15. WHEN a patch boundary changes THEN the system SHALL enqueue clinic membership re-evaluation for affected clinics.

### Coverage analytics

16. WHEN `GET /territories/:id/coverage-view` is called for a `state` or `intermediate` territory THEN the system SHALL return the reference boundary, per-patch clipped boundaries, and clinics assigned to intersecting patches that are physically inside the reference region.
17. WHEN a user lists clinics or doctors THEN the system SHALL filter results by territory scope at the data layer.

### Audit & approvals

18. WHEN a territory assignment or clinic territory override changes THEN the system SHALL audit the change where applicable (approval workflow / admin override).
19. IF a manager has reports but no territory assignment THEN the system SHALL follow the explicit product rule defined in F-008 for manager scope.

## API Surface (implemented)

| Endpoint | Purpose |
|----------|---------|
| `GET/POST /territories` | List / create |
| `PUT /territories/:id/boundary` | Save boundary (operational or reference flow) |
| `GET /territories/:id/operational-members` | Patches intersecting a reference territory |
| `GET /territories/:id/geo-memberships` | Reference regions intersecting a patch |
| `GET /territories/:id/coverage-view` | State/municipality coverage payload |
| `POST /territories/recompute-membership` | Admin force clinic geo recompute |

See Spec 37 for the full endpoint table and design detail.

## Out of scope (deferred)

- Web coverage map UI (clipped patch layers + clinic markers) — API ready
- Persistent clipped-geometry cache
- Order/visit territory snapshot fields (Spec 06 / 11)
- `POST /territories/:id/split`
