# Spec 37 — Territory Management

**Domain:** Territory Management (Hierarchy · Boundaries · Assignments · Geo Membership · Coverage Analytics)  
**Status:** Implemented (backend); partial web admin  
**Last Updated:** 2026-06-19  
**Scope:** API, PostGIS, scope resolver, geo membership index, Brazil reference geography ingestion, web boundary editor (Mapbox).

**Replaces / supersedes:** F-101 appendix in [Spec 00 — Platform Foundation](./00-platform-foundation.md#territory-entity-requirements)  
**Depends on:** [Spec 00 — Platform Foundation](./00-platform-foundation.md) (F-008 scope system, F-009 user management)  
**Prerequisite for:** [Spec 10 — Market Segmentation](./10-market-segmentation.md), [Spec 11 — Visit Lifecycle](./11-visit-lifecycle-frequency.md), [Spec 05 — Territory Map](./05-territory-map.md), [Spec 06 — Orders](./06-orders.md), [Spec 25 — Admin Analytics](./25-admin-marketing-analytics.md)

> **Implementation status:** Core backend is live. `Territory`, `TerritoryType`, `TerritoryClosure`, `TerritoryGeoMembership`, PostGIS boundaries, clinic geo assignment, scope expansion via closure + geo membership, Brazil IBGE ingestion, and REST APIs are implemented. Web admin includes territory CRUD dialogs and a Mapbox boundary editor. State/municipality **coverage map UI** (clipped patches + clinic markers) is deferred; the `GET /territories/:id/coverage-view` API is implemented.

---

## Overview

Territory management defines **where** commercial activity happens in Atlasmed. It answers four distinct questions:

1. **Structure** — How territories are organized (reference geography tree + operational patches).
2. **Geo linkage** — Which reference regions (states, municipalities) each operational patch intersects.
3. **Membership** — Which establishments belong to which operational patch (geo-driven, not rep-assigned).
4. **Access** — Which representatives and managers can operate on which territories (assignment with descendant + geo-membership expansion).

Territory is the **first access-control axis**. Market segmentation (Spec 10) is the second axis and is applied **after** territory scope is resolved.

### Core invariants

| Rule | Description |
|------|-------------|
| **Reps are assigned to territories, not clinics** | `UserTerritoryAssignment` links users to territory nodes. Reps never receive direct clinic assignments. |
| **Clinics belong to exactly one operational patch** | `Clinic.territoryId` FK to a territory with `TerritoryType.assignsClinics = true` (slug `patch`). |
| **Parent assignment expands downward** | User scope includes closure descendants of assigned territories **plus** operational patches linked via `territory_geo_membership` when assigned to a reference territory. |
| **Geo assigns membership; FK stores it** | Point-in-polygon runs on write (ingest, create, boundary change). Reads filter on `Clinic.territoryId` — never recompute polygons per request. |
| **Reference geography uses manual tree parents** | Country, macro-region, state, and municipality nodes keep admin-defined `parentId`; boundaries do not auto-reparent them. |
| **Operational patches use geo membership, not tree parent for scope** | A patch may span multiple states/municipalities; intersections are stored in `territory_geo_membership` and drive scope + analytics. |
| **Transactions snapshot territory** | Orders and visits store `territoryId` at creation time for accurate historical roll-up (Spec 06 / 11 — when those specs ship). |

### Dual-layer model (reference vs operational)

The system uses **two complementary layers**, not a single fixed 4-level tree:

| Layer | Territory types (slug) | Parent | Boundary | Clinics |
|-------|------------------------|--------|----------|---------|
| **Reference geography** | `country`, `region`, `state`, `intermediate` | Manual tree (`parentId` + closure) | Full IBGE/admin boundary | No |
| **Operational** | `patch` (`assignsClinics: true`) | Defaults to active country (`br`) | Full patch boundary (may be MultiPolygon) | Yes |

**Geo membership** (`territory_geo_membership`) links operational patches to reference `state` and `intermediate` (municipality) territories. Membership rows are **computed automatically** when a patch boundary is saved — admins do not declare intersections manually.

| Field | Purpose |
|-------|---------|
| `overlapRatio` | Share of patch area inside the reference region (min 1% threshold) |
| `intersectionAreaSqKm` | Absolute intersection area for ranking/debug |
| `referenceTypeSlug` | `state` or `intermediate` |

**Clipped geometry** (patch ∩ reference) is computed **on demand** via `ST_Intersection` for map display and coverage APIs. A persistent clipped-geometry cache is **deferred** until measured performance requires it.

### Territory types (replaces fixed levels 0–3)

Types are configurable via `TerritoryType` records. Brazil seed types:

| Slug | `assignsClinics` | `canHaveBoundary` | `isCountryLevel` | Role |
|------|------------------|-------------------|------------------|------|
| `country` | false | true | true | Root (`BR`) |
| `region` | false | true | false | IBGE macro-region |
| `state` | false | true | false | UF |
| `intermediate` | false | true | false | Municipality |
| `patch` | true | true | false | Sales territory |

Type flags also control: `assignableToUsers`, `assignableToManagers`, `blockSiblingOverlap` (patches block overlapping siblings).

### Brazil reference geography

Script: `apps/api/src/scripts/ingest-brazil-geography.ts`  
Run: `bun run db:ingest:brazil` (from `apps/api`)

Hierarchy ingested from IBGE API v3:

```
Brasil (BR)
 └── 5 macro-regions (BR-MACRO-{sigla})
      └── 27 states (BR-UF-{UF})
           └── ~5,570 municipalities (IBGE code)
```

- Invalid IBGE geometries are repaired with `ST_MakeValid` on save.
- Legacy `brasil` country root is deactivated; active root is `br` / `BR`.
- Closure table is rebuilt after ingestion.

### Relationship to other specs

| Spec | Integration |
|------|-------------|
| **Spec 10** | Segment filter ANDed after territory scope. |
| **Spec 21** | Manual clinic territory moves use `territory_reassignment` approval type. |
| **Spec 33** | CNES ingestion triggers geo assignment when clinic coordinates are present. |
| **Spec 05** | Map pins filtered by effective territory scope (+ segments after Spec 10). |
| **Spec 06 / 11** | Orders and visits snapshot `territoryId` from clinic at creation. |
| **Spec 25** | Admin analytics filter by territory node includes descendants + geo-linked patches. |

---

## User Stories

### Territory structure (admin)

**US-TERR-01 — Create territory hierarchy**  
As an admin, I want to create territories with configurable types, so that reference geography and operational patches coexist.

**US-TERR-02 — Reparent territories**  
As an admin, I want to change a territory's parent, so that I can reorganize reference geography without recreating data.

**US-TERR-03 — Add operational patches**  
As an admin, I want to add patch territories that may span multiple states/municipalities, so that sales coverage matches real boundaries.

**US-TERR-04 — Submit territory boundary**  
As an admin or manager, I want to submit GeoJSON for a territory, so that clinics are assigned (patches) or reference shapes are stored (IBGE layers).

**US-TERR-05 — Deactivate a territory**  
As an admin, I want to deactivate a territory that is no longer used, so that it cannot receive new assignments while history is preserved.

### Representative & manager assignment

**US-TERR-06 — Assign rep to territory**  
As an admin, I want to assign a representative to one or more territories, so that they only see establishments in their coverage area.

**US-TERR-07 — Regional manager sees all children**  
As a manager assigned to São Paulo state, I want to see clinics in patches that intersect SP **and** whose coordinates fall inside SP, so that I can oversee the state portion of cross-boundary patches.

**US-TERR-08 — View my territory on profile**  
As a representative, I want to see which territories I am assigned to, so that I understand my coverage scope.

### Clinic membership (automatic + override)

**US-TERR-09 — Auto-assign clinic by location**  
As the system, when a clinic is created or ingested with coordinates, I want to assign it to the patch whose boundary contains the point.

**US-TERR-10 — Manual override with approval**  
As an admin, I want to move a clinic to a different patch when geo assignment is wrong, with an auditable approval trail.

**US-TERR-11 — Recompute on boundary change**  
As an admin, when I change a patch boundary, I want affected clinics re-evaluated and geo membership rebuilt.

### Coverage analytics

**US-TERR-12 — State coverage view**  
As a manager, I want to see a state's outline, each intersecting patch clipped to that state, and clinics physically inside the state, so that I can analyze coverage within administrative boundaries.

**US-TERR-13 — Historical accuracy after moves**  
As an admin, I want past orders and visits to retain the territory that applied at transaction time (when Spec 06/11 ship).

---

## Requirements & Acceptance Criteria

### Territory entity & hierarchy

**AC-TERR-01**  
WHEN an admin creates a territory THEN the system SHALL require: `name`, `territoryTypeId`, optional `parentId` (required for non-country types unless operational default applies), and `countryCode`. `slug` and `code` are derived from name/country rules.

**AC-TERR-02**  
WHEN a territory is created with a `parentId` THEN the parent SHALL exist and be active. The system SHALL prevent cycles.

**AC-TERR-03**  
WHEN `GET /territories?format=tree` is called THEN the system SHALL return a nested JSON tree with id, name, code, type, parentId, and active status.

**AC-TERR-04**  
WHEN an admin reparents a territory THEN the system SHALL update `parentId`, rebuild closure for the subtree, and invalidate scope caches for affected users.

**AC-TERR-05**  
WHEN an admin deactivates a territory THEN the system SHALL block deactivation when active children, assigned users, or assigned clinics still exist.

**AC-TERR-06**  
WHEN a country-level territory exists for a `countryCode` THEN exactly one active country root SHALL exist per country (MVP: `BR` / `br`).

**AC-TERR-07**  
WHEN a territory has `TerritoryType.assignsClinics = true` THEN it MAY receive clinic assignments. Reference geography types SHALL NOT receive clinic FK assignments.

---

### Boundary API (PostGIS)

**AC-TERR-08**  
WHEN `PUT /territories/:id/boundary` is called for a type with `canHaveBoundary` THEN the system SHALL accept GeoJSON `Polygon` or `MultiPolygon`, validate geometry, persist in PostGIS, update bounding-box metadata, and run the appropriate post-save flow:

| Territory kind | Post-save behavior |
|----------------|-------------------|
| Operational (`patch`) | Rebuild `territory_geo_membership`; enqueue clinic membership recompute; invalidate scope |
| Reference geography | Store boundary only (no geo auto-parent) |
| Other (legacy geo-parent types) | Run geo parent resolution + rollup links |

**AC-TERR-09**  
Invalid geometry SHALL be rejected with `422`. Reference geography ingestion MAY pass `repairInvalid: true` (IBGE data).

**AC-TERR-10**  
WHEN a patch boundary overlaps a sibling patch (`blockSiblingOverlap`) THEN the save SHALL be hard-blocked with conflicting territory ids/codes.

**AC-TERR-11**  
WHEN a patch boundary is saved THEN geo membership SHALL be computed via `ST_Intersection` against all active `state` and `intermediate` territories in the same country. Rows below `GEO_MEMBERSHIP_MIN_OVERLAP_RATIO` (1%) are excluded.

---

### Geo membership & scope

**AC-TERR-12**  
`territory_geo_membership` SHALL store operational↔reference links with `overlapRatio` and `intersectionAreaSqKm`.

**AC-TERR-13**  
WHEN scope is resolved THEN `effectiveTerritoryIds` SHALL include:

1. Assigned territory IDs  
2. All active closure descendants  
3. Operational patch IDs linked via geo membership to any assigned reference territory  

**AC-TERR-14**  
WHEN a user's territory assignment changes THEN Redis `ScopeContext` cache SHALL be invalidated.

**AC-TERR-15**  
`GET /territories/:id/operational-members` SHALL list patches intersecting a reference territory.  
`GET /territories/:id/geo-memberships` SHALL list reference regions intersecting a patch.  
`GET /territories/:operationalId/clipped-boundary/:referenceId` SHALL return patch geometry clipped to the reference region.

**AC-TERR-16**  
`GET /territories/:id/coverage-view` (reference territory only: `state` or `intermediate`) SHALL return:

- Reference boundary (full)  
- Per-patch: membership stats, clipped boundary, clinics assigned to the patch **and** physically inside the reference (`ST_Covers`)  

---

### Clinic membership (geo assignment)

**AC-TERR-19**  
WHEN a clinic has valid `lat`/`lng` and `territoryAssignmentSource = 'geo'` THEN the system SHALL assign it to the containing active patch via `ST_Covers`.

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
| POST | `/territories` | Create territory |
| GET | `/territories/:id` | Detail |
| PATCH | `/territories/:id` | Update |
| DELETE | `/territories/:id` | Deactivate |
| GET | `/territories/:id/boundary` | GeoJSON boundary |
| PUT | `/territories/:id/boundary` | Save boundary |
| DELETE | `/territories/:id/boundary` | Remove boundary |
| GET | `/territories/:id/descendants` | Descendant IDs |
| GET | `/territories/:id/operational-members` | Patches intersecting reference |
| GET | `/territories/:id/geo-memberships` | References intersecting patch |
| GET | `/territories/:operationalId/clipped-boundary/:referenceId` | Clipped geometry |
| GET | `/territories/:id/coverage-view` | State/municipality coverage payload |
| POST | `/territories/recompute-membership` | Force clinic geo recompute |
| GET | `/territories/unassigned-clinics` | Unassigned/ambiguous clinics |
| GET/POST | `/territory-types` | Type CRUD |
| GET/POST/DELETE | `/territories/:id/rollup-links` | Reporting rollups |
| POST | `/territories/approval-requests` | Territory approval workflow |

**AC-TERR-35**  
Managers have read access to territories in scope; boundary write on patches in scope per permission rules.

---

## Design

### Data model (implemented)

Key models in `packages/database/prisma/schema.prisma`:

- `TerritoryType` — capability flags per type  
- `Territory` — node with `territoryTypeId`, `parentId`, PostGIS `boundary`, metadata (`boundaryMinLng`, etc.), `geoMembershipStatus`  
- `TerritoryClosure` — ancestor/descendant pairs for scope expansion  
- `TerritoryGeoMembership` — operational↔reference intersection index  
- `TerritoryRollupLink` — optional reporting ancestors beyond tree parent  
- `Clinic` — `territoryId`, `territoryAssignmentStatus`, `territoryAssignmentSource`  

PostGIS `boundary` column on `territories`; reads/writes via `ST_GeomFromGeoJSON` / `ST_AsGeoJSON`.

### Scope resolution

```typescript
interface ScopeContext {
  isGlobal: boolean;
  assignedTerritoryIds: string[];
  effectiveTerritoryIds: string[];  // closure descendants ∪ geo-linked patches
  clinicIds: string[];
  managedUserIds: string[];
  segmentIds: string[];
}
```

`PrismaTerritoryHierarchyPort.resolveDescendantIds` unions closure descendants with operational patch IDs from `territory_geo_membership` when resolving scope for reference territories.

### Geo membership algorithm

On patch boundary save:

```
1. Normalize GeoJSON (single-part MultiPolygon → Polygon)
2. Save boundary + update bbox metadata
3. DELETE existing membership rows for patch
4. PostGIS: ST_Intersection(patch, reference.boundary) for each state/intermediate in country
5. INSERT rows where overlapRatio >= 0.01
6. Set geoMembershipStatus = ready
7. Enqueue clinic membership recompute; invalidate scope caches
```

### Coverage view query pattern

Clinics in reference region (single batch query):

```sql
SELECT c.*, op.code
FROM clinics c
JOIN territories op ON op.id = c."territoryId"
JOIN territory_geo_membership m ON m."operationalTerritoryId" = op.id
JOIN territories ref ON ref.id = m."referenceTerritoryId"
WHERE m."referenceTerritoryId" = :refId
  AND c."territoryAssignmentStatus" = 'assigned'
  AND ST_Covers(ref.boundary, ST_MakePoint(c.lng, c.lat))
```

### Module layout

```
apps/api/src/modules/territory/
  application/
    constants/territory-geo-membership.constants.ts
    services/
      territory-boundary.application.ts      # applyTerritoryBoundary
      territory-geo-membership.service.ts
      territory-geo-parent.service.ts
      territory-membership.service.ts
    use-cases/
      territory-coverage.use-cases.ts        # coverage-view
      territory-geo-membership.use-cases.ts
      territory-boundary.use-cases.ts
    utils/
      territory-boundary.utils.ts
      territory-boundary-resolution.utils.ts
  infrastructure/
    repositories/prisma/prisma-territory-spatial.repository.ts
    ports/prisma-territory-hierarchy.port.ts
```

### Web (partial)

- Territory create/edit dialogs with type selection  
- Mapbox boundary editor (`territory-boundary-section.tsx`)  
- API client methods for geo membership endpoints  
- **Deferred:** coverage map UI consuming `coverage-view`

---

## Implementation status by phase

| Phase | Status | Notes |
|-------|--------|-------|
| PostGIS + data model | Done | Territory, types, closure, geo membership migration |
| Territory CRUD API | Done | Type-aware create/update |
| Boundary API | Done | Operational vs reference flows |
| Brazil IBGE ingestion | Done | ~5,604 territories |
| Geo membership index | Done | Auto on patch save |
| Scope resolver + cache invalidation | Done | Membership-aware hierarchy port |
| Clinic geo assignment + recompute job | Done | BullMQ queue |
| Coverage view API | Done | `GET /territories/:id/coverage-view` |
| Coverage map UI | Deferred | API ready |
| Clipped geometry cache | Deferred | On-demand ST_Intersection |
| Order/visit territory snapshots | Deferred | Spec 06 / 11 |
| `POST /territories/:id/split` | Deferred | Manual workflow |

---

## Resolved decisions

| # | Decision |
|---|----------|
| 1 | **Dual model:** Reference geography (IBGE tree) + operational patches with geo membership |
| 2 | **No fixed 4 levels:** `TerritoryType` flags replace level 0–3 |
| 3 | **Patch overlaps:** Hard-block sibling patch overlaps; cross-state patches allowed via membership |
| 4 | **Geo membership:** Automatic on boundary save; 1% minimum overlap |
| 5 | **Clipped geometry:** On demand; cache deferred |
| 6 | **Scope:** Closure ∪ geo-linked operational patches |
| 7 | **Brazil codes:** `BR`, `BR-MACRO-*`, `BR-UF-*`, IBGE municipality code |
| 8 | **Map UI:** Web boundary editor implemented (Mapbox) |
| 9 | **Point assignment:** `ST_Covers` |
| 10 | **Manual clinic lock:** `territoryAssignmentSource = 'manual'` until unlock |

---

## Deferred / open items

| Item | Default |
|------|---------|
| Coverage map UI (SP view with clipped layers) | Build when analytics UX is prioritized |
| Persistent clipped-geometry cache | Add when profiling shows need |
| `POST /territories/:id/split` | Manual migration workflow |
| Transaction territory snapshots | When Spec 06 / 11 ship |
