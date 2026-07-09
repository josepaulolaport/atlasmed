# Spec 37 — Territory Management

**Domain:** Territory Management (Assignment · Grouping · Boundaries · Scope · Analytics)  
**Status:** Implemented (backend); web admin updated for dual-graph model  
**Last Updated:** 2026-07-07  
**Scope:** API, PostGIS, scope resolver, Brazil reference geography ingestion, web boundary editor (Mapbox).

**Replaces / supersedes:** F-101 appendix in [Spec 00 — Platform Foundation](./00-platform-foundation.md#territory-entity-requirements)  
**Depends on:** [Spec 00 — Platform Foundation](./00-platform-foundation.md) (F-008 scope system, F-009 user management)  
**Prerequisite for:** [Spec 10 — Market Segmentation](./10-market-segmentation.md), [Spec 11 — Visit Lifecycle](./11-visit-lifecycle-frequency.md), [Spec 05 — Territory Map](./05-territory-map.md), [Spec 06 — Orders](./06-orders.md), [Spec 25 — Admin Analytics](./25-admin-marketing-analytics.md)

> **Implementation status:** Core backend is live. The system uses a **dual-graph territory model**: flat manager zones → rep patches for assignment/scope, and a separate grouping tree (region/state/municipality) for filter drill-down and analytics. Geo membership, geo-parenting, rollup links, and ambiguous-parent queues have been removed.

---

## Overview

Territory management defines **where** commercial activity happens in Atlasmed. It answers four distinct questions:

1. **Assignment** — Which manager zones contain which rep patches (flat containment graph).
2. **Grouping** — How administrative shapes are organized for filter navigation (tree only).
3. **Membership** — Which clinics belong to which rep patch (geo-driven on write).
4. **Access** — Which representatives and managers can operate on which territories (FK-based scope expansion).

Territory is the **first access-control axis**. Market segmentation (Spec 10) is the second axis and is applied **after** territory scope is resolved.

### Core invariants

| Rule | Description |
|------|-------------|
| **Reps are assigned to territories, not clinics** | `UserTerritoryAssignment` links users to territory nodes. Reps never receive direct clinic assignments. |
| **Clinics belong to exactly one rep patch** | `Clinic.territoryId` FK to a territory with `TerritoryType.assignsClinics = true`. |
| **Manager scope expands via FK** | Manager assigned to a manager zone sees rep patches where `rep_patch.managerTerritoryId` matches. No closure or geometry at login. |
| **Grouping tree does not drive scope** | `parentId` + closure apply only to types with `participatesInGroupingHierarchy = true`. |
| **Geo assigns membership; FK stores it** | Point-in-polygon runs on write (ingest, create, boundary change). Reads filter on `Clinic.territoryId`. |
| **Rep patches must be fully inside one manager zone** | On boundary save, `ST_CoveredBy(patch, manager_zone)` must resolve to exactly one active manager zone. |
| **Transactions snapshot territory** | Orders and visits store `territoryId` at creation time for accurate historical roll-up (Spec 06 / 11 — when those specs ship). |

### Dual-graph model (assignment vs grouping)

The system uses **two independent spatial graphs**:

| Graph | Structure | Drives scope? | Drives analytics filter? |
|-------|-----------|---------------|--------------------------|
| **Assignment** | Flat manager zones → rep patches via `managerTerritoryId` | Yes | No |
| **Grouping** | Tree (`parentId` + closure) for region/state/municipality types | No | Yes (UI drill-down + `ST_Covers` on clinic point) |

**Manager zones** (`manager_zone` type slug) are flat — no tree parent. Sibling overlap is blocked.

**Rep patches** (`rep_patch` / legacy `patch` slug) link to exactly one manager zone. Sibling overlap is blocked.

**Grouping territories** (`region`, `state`, `intermediate`/`municipality`, `country`) use the tree for navigation. Overlapping grouping boundaries are allowed; analytics filter uses the selected node's own polygon.

### Territory types

Types are configurable via `TerritoryType` records. Key flags:

| Flag | Purpose |
|------|---------|
| `assignsClinics` | Rep patch — receives clinic FK assignments |
| `assignableToManagers` | Manager zone — managers can be assigned here |
| `assignableToUsers` | Rep patch — field reps can be assigned here |
| `participatesInGroupingHierarchy` | Appears in grouping tree; supports `parentId` + closure |
| `blockSiblingOverlap` | Reject overlapping sibling boundaries of the same type |
| `canHaveBoundary` | Supports PostGIS polygon boundary |
| `isCountryLevel` | Root grouping node per country |

Suggested Brazil seed configuration:

| Slug | assignsClinics | assignableToManagers | assignableToUsers | participatesInGroupingHierarchy | blockSiblingOverlap |
|------|----------------|----------------------|-------------------|--------------------------------|---------------------|
| `manager_zone` | false | true | false | false | true |
| `rep_patch` / `patch` | true | false | true | false | true |
| `country` | false | false | false | true | false |
| `region` | false | false | false | true | false |
| `state` | false | false | false | true | false |
| `intermediate` | false | false | false | true | false |

### Brazil reference geography

Script: `apps/api/src/scripts/ingest-brazil-geography.ts`  
Run: `bun run db:ingest:brazil` (from `apps/api`)

IBGE-aligned grouping shapes are ingested as optional seed data. Ingestion uses the same create/boundary path as manual admin entry — no special runtime geo-parent behavior.

### Relationship to other specs

| Spec | Integration |
|------|-------------|
| **Spec 10** | Segment filter ANDed after territory scope. |
| **Spec 21** | Manual clinic territory moves use `territory_reassignment` approval type. |
| **Spec 33** | CNES ingestion triggers geo assignment when clinic coordinates are present. |
| **Spec 05** | Map pins filtered by effective territory scope (+ segments after Spec 10). |
| **Spec 06 / 11** | Orders and visits snapshot `territoryId` from clinic at creation. |
| **Spec 25** | Admin analytics: scoped rep patches AND optional grouping spatial filter. |

---

## User Stories

### Territory structure (admin)

**US-TERR-01 — Create territory hierarchy**  
As an admin, I want to create grouping territories with configurable types, so that filter navigation matches administrative structure.

**US-TERR-02 — Reparent grouping territories**  
As an admin, I want to change a grouping territory's parent, so that I can reorganize reference geography without recreating data.

**US-TERR-03 — Add manager zones and rep patches**  
As an admin, I want flat manager zones and rep patches fully contained in a zone, so that assignment scope is unambiguous.

**US-TERR-04 — Submit territory boundary**  
As an admin or manager, I want to submit GeoJSON for a territory, so that clinics are assigned (patches), manager containment is validated (patches), or grouping shapes are stored.

**US-TERR-05 — Deactivate a territory**  
As an admin, I want to deactivate a territory that is no longer used, so that it cannot receive new assignments while history is preserved.

### Representative & manager assignment

**US-TERR-06 — Assign rep to territory**  
As an admin, I want to assign a representative to one or more rep patches, so that they only see establishments in their coverage area.

**US-TERR-07 — Regional manager sees zone patches**  
As a manager assigned to a manager zone, I want to see clinics in rep patches linked to that zone.

**US-TERR-08 — View my territory on profile**  
As a representative, I want to see which territories I am assigned to, so that I understand my coverage scope.

### Facility membership (automatic + override)

**US-TERR-09 — Auto-assign clinic by location**  
As the system, when a clinic is created or ingested with coordinates, I want to assign it to the rep patch whose boundary contains the point.

**US-TERR-10 — Manual override with approval**  
As an admin, I want to move a clinic to a different patch when geo assignment is wrong, with an auditable approval trail.

**US-TERR-11 — Recompute on boundary change**  
As an admin, when I change a rep patch boundary, I want affected clinics re-evaluated.

### Coverage analytics

**US-TERR-12 — Grouping analytics view**  
As a manager, I want to filter analytics by a grouping shape and see clinics in my scoped rep patches that fall inside that shape.

**US-TERR-13 — Historical accuracy after moves**  
As an admin, I want past orders and visits to retain the territory that applied at transaction time (when Spec 06/11 ship).

---

## Requirements & Acceptance Criteria

### Territory entity & hierarchy

**AC-TERR-01**  
WHEN an admin creates a territory THEN the system SHALL require: `name`, `territoryTypeId`, optional `parentId` (required for grouping types except country), and `countryCode`.

**AC-TERR-02**  
WHEN a grouping territory is created with a `parentId` THEN the parent SHALL exist, be active, and participate in the grouping hierarchy. The system SHALL prevent cycles.

**AC-TERR-03**  
WHEN `GET /territories?format=tree` is called THEN the system SHALL return a nested JSON tree of all active territories readable in scope.

**AC-TERR-04**  
WHEN `GET /territories/grouping-tree` is called THEN the system SHALL return only territories whose type has `participatesInGroupingHierarchy = true`.

**AC-TERR-05**  
WHEN an admin reparents a grouping territory THEN the system SHALL update `parentId`, rebuild closure for the subtree, and invalidate scope caches for affected users.

**AC-TERR-06**  
WHEN an admin deactivates a territory THEN the system SHALL block deactivation when active children (grouping), assigned users, assigned clinics, or child rep patches (manager zones) still exist.

**AC-TERR-07**  
WHEN a territory has `TerritoryType.assignsClinics = true` THEN it MAY receive clinic assignments. Manager zones and grouping types SHALL NOT receive clinic FK assignments.

---

### Boundary API (PostGIS)

**AC-TERR-08**  
WHEN `PUT /territories/:id/boundary` is called for a type with `canHaveBoundary` THEN the system SHALL accept GeoJSON `Polygon` or `MultiPolygon`, validate geometry, persist in PostGIS, update bounding-box metadata, and run the role-based post-save flow:

| Territory role | Post-save behavior |
|----------------|-------------------|
| Rep patch (`assignsClinics`) | Resolve exactly one containing manager zone → set `managerTerritoryId`; enqueue clinic membership recompute; invalidate scope |
| Manager zone (`assignableToManagers`) | Validate no rep patches would be orphaned; block sibling overlap |
| Grouping (`participatesInGroupingHierarchy`) | Store boundary only; rebuild closure if needed |

**AC-TERR-09**  
Invalid geometry SHALL be rejected with `422`. IBGE ingestion MAY pass `repairInvalid: true`.

**AC-TERR-10**  
WHEN a rep patch or manager zone boundary overlaps a sibling (`blockSiblingOverlap`) THEN the save SHALL be hard-blocked with conflicting territory ids/codes.

**AC-TERR-11**  
WHEN a rep patch boundary is saved THEN the system SHALL require exactly one active manager zone whose boundary fully contains the patch (`ST_CoveredBy`). Zero or multiple matches SHALL reject the save.

---

### Scope resolution

**AC-TERR-12**  
WHEN scope is resolved THEN `effectiveTerritoryIds` SHALL include:

1. Directly assigned territory IDs  
2. For manager zone assignments: all active rep patch IDs where `managerTerritoryId` is in assigned manager zone IDs  
3. For rep patch assignments: the patch ID itself  

Grouping closure and geo membership SHALL NOT expand scope.

**AC-TERR-13**  
WHEN a user's territory assignment changes THEN Redis `ScopeContext` cache SHALL be invalidated.

**AC-TERR-14**  
`GET /territories/:id/analytics-view` (grouping territory) SHALL return clinics in the caller's scoped rep patches whose coordinates fall inside the grouping boundary (`ST_Covers`).

---

### Facility membership (geo assignment)

**AC-TERR-19**  
WHEN a clinic has valid `lat`/`lng` and `territoryAssignmentSource = 'geo'` THEN the system SHALL assign it to the containing active rep patch via `ST_Covers`.

**AC-TERR-20**  
WHEN no patch contains the point THEN `territoryId = null`, `territoryAssignmentStatus = unassigned` (or `ambiguous` if multiple — should not occur with overlap block).

**AC-TERR-20a**  
WHEN `territoryAssignmentSource = 'manual'` THEN automatic geo recompute SHALL NOT change `territoryId` until unlock or approved reassignment.

**AC-TERR-21**  
Registry ingest (Spec 33) with coordinates SHALL trigger geo assignment after upsert.

**AC-TERR-22**  
Admin manual override SHALL set `territoryAssignmentSource = 'manual'`, audit, and invalidate caches.

---

### Authorization integration

**AC-TERR-25**  
Non-admin clinic/doctor queries SHALL apply `Clinic.territoryId IN effectiveTerritoryIds` at the data layer.

**AC-TERR-26**  
`assertResourceInScope` SHALL deny access when clinic territory is outside effective scope.

**AC-TERR-28**  
ADMIN users SHALL have global territory scope unless restricted by segments.

---

### Territory CRUD API

**AC-TERR-34** — Implemented endpoints under `/api/v1/territories`:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/territories` | List tree or flat |
| GET | `/territories/grouping-tree` | Grouping hierarchy only |
| POST | `/territories` | Create territory |
| GET | `/territories/:id` | Detail |
| PATCH | `/territories/:id` | Update |
| DELETE | `/territories/:id` | Deactivate |
| GET | `/territories/:id/boundary` | GeoJSON boundary |
| PUT | `/territories/:id/boundary` | Save boundary |
| DELETE | `/territories/:id/boundary` | Remove boundary |
| GET | `/territories/:id/descendants` | Descendant IDs (grouping) |
| GET | `/territories/:id/analytics-view` | Scoped clinics inside grouping shape |
| POST | `/territories/recompute-membership` | Force clinic geo recompute |
| GET | `/territories/unassigned-facilities` | Unassigned/ambiguous clinics |
| GET/POST | `/territory-types` | Type CRUD |
| POST | `/territories/approval-requests` | Territory approval workflow |

**Removed endpoints:** `geo-memberships`, `operational-members`, `clipped-boundary`, `coverage-view`, `ambiguous-parents`, `rollup-links`.

**AC-TERR-35**  
Managers have read access to territories in scope; boundary write on patches in scope per permission rules.

---

## Design

### Data model (implemented)

Key models in `packages/database/prisma/schema.prisma`:

- `TerritoryType` — capability flags including `participatesInGroupingHierarchy`  
- `Territory` — node with `territoryTypeId`, optional `parentId` (grouping only), `managerTerritoryId` (rep patches only), PostGIS `boundary`  
- `TerritoryClosure` — ancestor/descendant pairs for grouping scope expansion in tree queries only  
- `Clinic` — `territoryId`, `territoryAssignmentStatus`, `territoryAssignmentSource`  

**Removed:** `TerritoryGeoMembership`, `TerritoryRollupLink`, `parentAssignmentStatus`, `parentAssignmentSource`, `geoMembershipStatus`.

### Scope resolution

```typescript
interface ScopeContext {
  isGlobal: boolean;
  assignedTerritoryIds: string[];
  effectiveTerritoryIds: string[];  // assigned + FK-linked rep patches for manager zones
  facilityIds: string[];
  managedUserIds: string[];
  segmentIds: string[];
}
```

`PrismaTerritoryHierarchyPort.resolveEffectiveTerritoryIds` expands manager zone assignments to contained rep patches via `managerTerritoryId` FK lookup.

### Analytics query pattern

Clinics in scoped patches AND inside grouping filter:

```sql
SELECT c.*
FROM clinics c
JOIN territories patch ON patch.id = c."territoryId"
JOIN territories grouping ON grouping.id = :groupingTerritoryId
WHERE c."territoryId" = ANY(:scopedPatchIds)
  AND c."territoryAssignmentStatus" = 'assigned'
  AND ST_Covers(grouping.boundary, ST_SetSRID(ST_MakePoint(c.lng, c.lat), 4326))
```

### Module layout

```
apps/api/src/modules/territory/
  application/
    constants/territory-roles.constants.ts
    services/
      territory-boundary.application.ts
      territory-containment.service.ts
      territory-membership.service.ts
    use-cases/
      territory-coverage.use-cases.ts        # analytics-view
      territory-crud.use-cases.ts
  infrastructure/
    repositories/prisma/prisma-territory-spatial.repository.ts
    ports/prisma-territory-hierarchy.port.ts
```

### Web

- Territory admin: **Grouping**, **Manager zones**, and **Rep patches** view tabs on `/territories`  
- Mapbox boundary editor (`territory-boundary-section.tsx`)  
- Grouping tree API for filter UIs  
- **Deferred:** full analytics map UI consuming `analytics-view`

### Migration

- `20260707120000_territory_dual_graph` — `managerTerritoryId`, `participatesInGroupingHierarchy`, `manager_zone` type seed  
- `20260707130000_territory_drop_legacy_geo` — drop geo membership, rollup links, parent-assignment columns  
- Backfill: `apps/api/src/scripts/backfill-patch-manager-zones.ts` (applied, script removed)

---

## Implementation status by phase

| Phase | Status | Notes |
|-------|--------|-------|
| Dual-graph schema | Done | managerTerritoryId + grouping flag |
| Containment service | Done | Exactly-one manager zone on patch save |
| FK-based scope | Done | No geo membership expansion |
| Analytics view API | Done | `GET /territories/:id/analytics-view` |
| Legacy cleanup | Done | Geo membership, rollups, ambiguous parents removed |
| Web admin tabs | Done | Grouping / manager zones / rep patches |
| Order/visit territory snapshots | Deferred | Spec 06 / 11 |
| Analytics map UI | Deferred | API ready |

---

## Resolved decisions

| # | Decision |
|---|----------|
| 1 | **Dual graph:** Flat assignment (manager zone → rep patch) + grouping tree for filters |
| 2 | **Scope:** FK on `managerTerritoryId`, not closure or geo membership |
| 3 | **Patch overlaps:** Hard-block sibling rep patch and manager zone overlaps |
| 4 | **Grouping overlaps:** Allowed — analytics uses point-in-polygon on selected shape |
| 5 | **Analytics semantics:** `scope AND filter` on clinic coordinates |
| 6 | **Brazil codes:** `BR`, `BR-MACRO-*`, `BR-UF-*`, IBGE municipality code |
| 7 | **Point assignment:** `ST_Covers` on rep patch boundaries |
| 8 | **Manual clinic lock:** `territoryAssignmentSource = 'manual'` until unlock |

---

## Deferred / open items

| Item | Default |
|------|---------|
| Analytics map UI | Build when analytics UX is prioritized |
| Order/visit territory snapshots | When Spec 06 / 11 ship |
| `POST /territories/:id/split` | Manual migration workflow |
