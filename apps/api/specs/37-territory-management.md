# Spec 37 — Territory Management

**Domain:** Territory Management (Hierarchy · Boundaries · Assignments · Geo Membership · Analytics Roll-Up)  
**Status:** Not started — planned  
**Last Updated:** 2026-06-15  
**Scope:** **Backend only (V1)** — API, PostGIS, scope resolver, geo membership. No Mapbox or map UI dependencies; boundary submission is GeoJSON via REST. Web admin map editor is deferred.

**Replaces / supersedes:** F-101 appendix in [Spec 00 — Platform Foundation](./00-platform-foundation.md#territory-entity-requirements)  
**Depends on:** [Spec 00 — Platform Foundation](./00-platform-foundation.md) (F-008 scope system, F-009 user management)  
**Prerequisite for:** [Spec 10 — Market Segmentation](./10-market-segmentation.md), [Spec 11 — Visit Lifecycle](./11-visit-lifecycle-frequency.md), [Spec 05 — Territory Map](./05-territory-map.md), [Spec 06 — Orders](./06-orders.md), [Spec 25 — Admin Analytics](./25-admin-marketing-analytics.md)

> **Implementation status:** Not started. Today `territoryId` is a plain string on `Clinic` and `UserTerritoryAssignment` (F-008). There is no `Territory` table, no hierarchy, no geo boundaries, and no closure-based roll-up. This spec is the authoritative definition of F-101.

---

## Overview

Territory management defines **where** commercial activity happens in Atlasmed. It answers three distinct questions:

1. **Structure** — How territories are organized (region → sub-region → patch).
2. **Membership** — Which establishments belong to which territory (geo-driven, not rep-assigned).
3. **Access** — Which representatives and managers can operate on which territories (assignment with descendant expansion).

Territory is the **first access-control axis**. Market segmentation (Spec 10) is the second axis and is applied **after** territory scope is resolved.

### Core invariants

| Rule | Description |
|------|-------------|
| **Reps are assigned to territories, not clinics** | `UserTerritoryAssignment` links users to territory nodes. Reps never receive direct clinic assignments. |
| **Clinics belong to exactly one territory** | `Clinic.territoryId` is a required FK to a **leaf** territory. No clinic–territory junction table. |
| **Parent assignment expands downward** | When a user is assigned to a parent territory, scope includes all descendant territories (and their clinics). |
| **Geo assigns membership; FK stores it** | Point-in-polygon runs on write (ingest, create, boundary change). Reads filter on `Clinic.territoryId` — never recompute polygons per request. |
| **Transactions snapshot territory** | Orders and visits store `territoryId` at creation time for accurate historical roll-up (e.g. "sales in Sudeste in Q1"). |

### Hierarchy levels (V1)

Territories form a tree up to **4 levels**. Each node has a `level` derived from depth (or set explicitly on create):

| Level | Name | Example code | Has boundary? | Has clinics? |
|-------|------|--------------|---------------|--------------|
| 0 | Country / org root | `BR` | No | No |
| 1 | Macro-region | `BR-SE` | No | No |
| 2 | State | `BR-SE-SP` | No | No |
| 3 | Leaf patch | `BR-SE-SP-01` | Yes (PostGIS) | Yes |

> **Invariant:** Only **level-3 leaf** territories accept boundaries and clinic membership. Adding a child to a leaf automatically clears its boundary and blocks until clinics are migrated (AC-TERR-07b).

### Relationship to other specs

| Spec | Integration |
|------|-------------|
| **Spec 10** | Segment filter ANDed after territory scope. Spec 37 must ship **before** Spec 10. |
| **Spec 21** | Manual clinic territory moves use `territory_reassignment` approval type. |
| **Spec 33** | CNES ingestion triggers geo assignment when clinic coordinates are present. |
| **Spec 05** | Map pins filtered by effective territory scope (+ segments after Spec 10). |
| **Spec 06 / 11** | Orders and visits snapshot `territoryId` from clinic at creation. |
| **Spec 25** | Admin analytics filter by territory node includes all descendants by default. |

---

## User Stories

### Territory structure (admin)

**US-TERR-01 — Create territory hierarchy**  
As an admin, I want to create territories in a tree (region → sub-region → patch), so that the org structure matches how we manage the field force.

**US-TERR-02 — Reparent territories**  
As an admin, I want to change a territory's parent or move it to root, so that I can reorganize regions without recreating data.

**US-TERR-03 — Add and remove leaf patches**  
As an admin, I want to add new leaf territories and retire old ones, so that coverage areas can evolve as the business grows.

**US-TERR-04 — Submit territory boundary (API)**  
As an admin or manager, I want to submit a GeoJSON polygon for a leaf territory via the API, so that establishments are assigned automatically by location without a map SDK dependency.

**US-TERR-05 — Deactivate a territory**  
As an admin, I want to deactivate a territory that is no longer used, so that it cannot receive new assignments while history is preserved.

### Representative & manager assignment

**US-TERR-06 — Assign rep to territory**  
As an admin, I want to assign a representative to one or more territories, so that they only see establishments in their coverage area.

**US-TERR-07 — Regional manager sees all children**  
As a manager assigned to a parent territory (e.g. Sudeste), I want to see all clinics in child territories, so that I can oversee the full region.

**US-TERR-08 — View my territory on profile**  
As a representative, I want to see which territories I am assigned to, so that I understand my coverage scope.

### Clinic membership (automatic + override)

**US-TERR-09 — Auto-assign clinic by location**  
As the system, when a clinic is created or ingested with coordinates, I want to assign it to the leaf territory whose boundary contains the point, so that membership stays accurate without manual work.

**US-TERR-10 — Manual override with approval**  
As an admin, I want to move a clinic to a different territory when geo assignment is wrong, with an auditable approval trail, so that edge cases are handled safely.

**US-TERR-11 — Recompute on boundary change**  
As an admin, when I change a territory boundary, I want affected clinics to be re-evaluated, so that membership reflects the new geography.

### Analytics roll-up

**US-TERR-12 — Sales by parent territory**  
As an admin, I want to filter analytics (e.g. orders, revenue) by a parent territory and see aggregated results for all child patches, so that I can report on regions like "Sudeste".

**US-TERR-13 — Historical accuracy after moves**  
As an admin, I want past orders and visits to retain the territory that applied at transaction time, so that regional reports are not distorted by later reorganizations.

---

## Requirements & Acceptance Criteria

### Territory entity & hierarchy

**AC-TERR-01**  
WHEN an admin creates a territory THEN the system SHALL require: `name` (unique among siblings), `level` (0–3), optional `parentId` (required unless `level = 0`), and `isActive` (default `true`). The `code` SHALL be auto-generated per AC-TERR-01a (not user-editable after create).

**AC-TERR-01a — Code format (auto-generated, immutable after create)**

| Level | Pattern | Example |
|-------|---------|---------|
| 0 | `BR` | `BR` |
| 1 | `BR-{region}` | `BR-SE` (Sudeste) |
| 2 | `BR-{region}-{state}` | `BR-SE-SP` |
| 3 | `BR-{region}-{state}-{seq}` | `BR-SE-SP-01` |

- `{region}` — two-letter macro-region slug stored on the level-1 ancestor (e.g. `SE`, `S`, `NE`, `CO`, `N`)
- `{state}` — two-letter Brazilian state code (IBGE) stored on the level-2 ancestor (e.g. `SP`, `RJ`)
- `{seq}` — zero-padded sequence `01`, `02`, … per `{region}-{state}` prefix (state-wide, not per city)

**AC-TERR-01b**  
WHEN a level-3 leaf is created THEN the system SHALL inherit `{region}` and `{state}` from its level-2 parent chain.

**AC-TERR-02**  
WHEN a territory is created with a `parentId` THEN the parent SHALL exist and be active. The system SHALL prevent cycles in the hierarchy.

**AC-TERR-03**  
WHEN `GET /territories?format=tree` is called THEN the system SHALL return a nested JSON tree with: id, name, code, type indicator (region / sub-region / leaf), clinic count, assigned user count, and active status.

**AC-TERR-04**  
WHEN an admin reparents a territory THEN the system SHALL update `parentId`, rebuild the territory closure table (see Design), invalidate scope caches for all affected users, and enqueue clinic membership re-evaluation for all leaf descendants of the reparented subtree.

**AC-TERR-05**  
WHEN an admin deactivates a territory THEN the system SHALL: block new user assignments to it, block new clinic assignments to it, and return `422` if active children, assigned users, or assigned clinics still exist. Deactivation SHALL NOT hard-delete the record or historical references.

**AC-TERR-06**  
WHEN a territory has `level = 0` THEN it SHALL be the single org root (`BR`). Exactly one active level-0 node SHALL exist per organization (single-tenant MVP: one global root).

**AC-TERR-07**  
WHEN a territory is a **leaf** (`level = 3`, no active children) THEN it MAY have a PostGIS boundary and clinics. Non-leaf territories SHALL NOT have clinics assigned (`Clinic.territoryId` MUST reference a level-3 leaf).

**AC-TERR-07b**  
WHEN a child territory is created under a former leaf THEN the system SHALL: (1) reject if the parent has assigned clinics unless those clinics are first migrated or unassigned, (2) clear the parent's boundary geometry, (3) reclassify the parent as a container (no longer level-3 leaf).

**AC-TERR-07c**  
WHEN `POST /territories/:id/split` is called on a level-3 leaf that has clinics or a boundary THEN the system SHALL require definitions for the new child leaves, migrate clinics by geo reassignment, and deactivate or reparent the original leaf. Used when dividing a patch without manual clinic-by-clinic moves. *(Optional V1 endpoint — may defer to manual workflow if scope is tight.)*

---

### Boundary API (PostGIS — backend only)

**AC-TERR-08**  
WHEN an admin or manager calls `PUT /territories/:id/boundary` for a level-3 leaf within their permission scope THEN the system SHALL accept a GeoJSON `Polygon` or `MultiPolygon` body, validate geometry, persist it in PostGIS, and enqueue a clinic membership re-evaluation job.

**AC-TERR-08b**  
WHEN `GET /territories/:id/boundary` is called THEN the system SHALL return the stored boundary as GeoJSON (`ST_AsGeoJSON`) or `204` if none set. Admin and Manager (read) may call this endpoint.

**AC-TERR-09**  
WHEN a boundary is submitted THEN the system SHALL validate: polygon is closed, has ≥ 3 vertices, is valid geometry (`ST_IsValid`), uses SRID 4326 (WGS84), and does not self-intersect. Invalid geometry SHALL be rejected with `422` and a descriptive error.

**AC-TERR-10**  
WHEN a boundary is submitted for an active leaf territory THEN the system SHALL **hard-block** the save if the new geometry overlaps any other active leaf boundary (PostGIS: `ST_Intersects` with non-trivial intersection area — exclude shared-border touching only). The response SHALL list conflicting territory IDs and codes.

**AC-TERR-11**  
WHEN a boundary is saved successfully THEN the system SHALL enqueue a BullMQ job to re-evaluate clinic membership for clinics whose coordinates fall within the bounding box of the changed polygon and sibling territories in the same state/region.

**AC-TERR-12**  
Non-leaf territories SHALL NOT accept boundary geometry — only leaf territories assign clinics via point-in-polygon. Attempts to set a boundary on a non-leaf SHALL return `422`.

---

### User–territory assignment

**AC-TERR-13**  
WHEN an admin assigns a user to a territory THEN the system SHALL create a `UserTerritoryAssignment` record linking `userId` and `territoryId`. A user MAY have multiple territory assignments.

**AC-TERR-14**  
WHEN scope is resolved for a user THEN the system SHALL compute `effectiveTerritoryIds` as the assigned territory IDs **plus all active descendant territory IDs** (transitive closure). All clinic scope queries SHALL use `Clinic.territoryId IN effectiveTerritoryIds`.

**AC-TERR-15**  
WHEN a manager's scope is resolved (F-008) THEN the system SHALL include territories assigned to all direct reports, expanded to descendants, UNIONed with the manager's own assignments (if any).

**AC-TERR-16**  
WHEN a user's territory assignment changes THEN the system SHALL invalidate their Redis `ScopeContext` cache and force token refresh on next request (or immediate session scope update).

**AC-TERR-17**  
WHEN an admin removes a user's territory assignment THEN the user SHALL immediately lose visibility of clinics exclusively in that territory subtree (after cache invalidation).

**AC-TERR-18**  
Existing APIs `POST /users/:id/territories` and `DELETE /users/:id/territories/:territoryId` (F-008) SHALL be updated to validate `territoryId` against the `Territory` table (FK) instead of accepting arbitrary strings.

---

### Clinic membership (geo assignment)

**AC-TERR-19**  
WHEN a clinic is created or updated with valid `lat` and `lng` AND `territoryAssignmentSource = 'geo'` THEN the system SHALL determine the containing active level-3 leaf using PostGIS `ST_Covers(boundary, ST_SetSRID(ST_MakePoint(lng, lat), 4326))` (includes points on the boundary edge). If exactly one leaf matches, the system SHALL set `Clinic.territoryId` to that leaf and `territoryAssignmentStatus = 'assigned'`.

**AC-TERR-20**  
WHEN a clinic's coordinates fall outside all leaf boundaries, or match multiple leaves (should not occur if overlaps are hard-blocked), THEN the system SHALL set `Clinic.territoryId` to null, set `territoryAssignmentStatus` to `unassigned` or `ambiguous`, and include it in `GET /territories/unassigned-clinics`.

**AC-TERR-20a**  
WHEN a clinic has `territoryAssignmentSource = 'manual'` THEN automatic geo recompute (ingest, boundary change batch) SHALL NOT change its `territoryId` unless an admin explicitly clears the manual assignment via `POST /clinics/:id/territory/unlock-geo` or a new approved `territory_reassignment` (Spec 21).

**AC-TERR-21**  
WHEN a clinic is ingested via registry pipeline (Spec 33) with coordinates THEN geo assignment (AC-TERR-19) SHALL run automatically after upsert.

**AC-TERR-22**  
WHEN an admin manually sets a clinic's territory via `PATCH /clinics/:id/territory` THEN the system SHALL require the target to be an active level-3 leaf, apply the change immediately (ADMIN direct override in V1), set `territoryAssignmentSource = 'manual'`, write an audit log, and invalidate scope caches. Managers SHALL submit Spec 21 `territory_reassignment` requests instead of direct override.

**AC-TERR-23**  
WHEN a clinic territory changes THEN the system SHALL write an audit log entry with: previous territory, new territory, actor, reason, and timestamp. Scope cache for affected territories SHALL be invalidated.

**AC-TERR-24**  
Clinics SHALL NOT be assigned directly to representatives. Any UI implying "assign clinic to rep" SHALL be rejected — access is always derived: `user → territory → clinic`.

---

### Authorization integration

**AC-TERR-25**  
WHEN a non-admin user queries clinics or doctors THEN the backend SHALL apply `WHERE clinic.territory_id IN (effectiveTerritoryIds)` at the data layer. Frontend filtering alone is insufficient.

**AC-TERR-26**  
WHEN `assertResourceInScope(scope, "clinic", clinicId)` is called THEN the system SHALL load the clinic's `territoryId` and deny access if it is not in `effectiveTerritoryIds` (unless an instance grant overrides — F-007).

**AC-TERR-27**  
WHEN a doctor is queried THEN visibility SHALL be granted if the doctor has at least one active `DoctorClinicAssociation` to a clinic whose `territoryId` is in the user's `effectiveTerritoryIds` (plus segment filter when Spec 10 is active).

**AC-TERR-28**  
ADMIN users SHALL have global territory scope (all territories) unless restricted by explicit segment assignments (Spec 10 / Spec 25).

---

### Analytics roll-up & snapshots

**AC-TERR-29**  
WHEN an order is created (Spec 06) THEN the system SHALL snapshot `territoryId` from the destination clinic's current `territoryId` onto the order record as `territoryIdAtOrder`.

**AC-TERR-30**  
WHEN a visit is created (Spec 11) THEN the system SHALL snapshot `territoryId` from the visit's customer clinic as `territoryIdAtVisit` on the visit record.

**AC-TERR-31**  
WHEN an admin filters analytics by territory node `T` (Spec 25) THEN the system SHALL include all records whose snapshotted territory ID is in the descendant set of `T` (including `T` itself if it is a leaf with direct records).

**AC-TERR-32**  
WHEN an admin filters analytics by territory node `T` using current clinic assignment (operational view) THEN the system MAY optionally use `Clinic.territoryId` instead of snapshots — the UI SHALL label the two modes "At time of transaction" (default) vs "Current assignment".

**AC-TERR-33**  
WHEN reporting sales for a parent territory (e.g. Sudeste) THEN the system SHALL aggregate order totals from all orders where `territoryIdAtOrder` is in the descendant leaves of Sudeste — without requiring clinics to be assigned to the parent node.

---

### Territory CRUD API

**AC-TERR-34**  
The system SHALL expose REST endpoints under `/api/v1/territories`:

| Method | Path | Description | Who |
|--------|------|-------------|-----|
| GET | `/territories` | List as tree or flat (query: `format=tree\|flat`) | Admin, Manager (read) |
| POST | `/territories` | Create territory | Admin |
| GET | `/territories/:id` | Detail + stats | Admin, Manager (read) |
| PATCH | `/territories/:id` | Update name, code, parentId, isActive | Admin |
| GET | `/territories/:id/boundary` | Return GeoJSON boundary | Admin, Manager (read) |
| PUT | `/territories/:id/boundary` | Submit GeoJSON boundary (level-3 leaf only) | Admin; Manager (leaves in scope) |
| DELETE | `/territories/:id/boundary` | Remove boundary (level-3 leaf only) | Admin; Manager (leaves in scope) |
| PATCH | `/clinics/:id/territory` | Admin direct clinic territory override | Admin |
| POST | `/territories/:id/split` | Split leaf into child patches (optional V1) | Admin |
| DELETE | `/territories/:id` | Soft-deactivate (not hard delete) | Admin |
| GET | `/territories/:id/descendants` | List descendant IDs (for clients/debug) | Admin, Manager |
| POST | `/territories/recompute-membership` | Trigger clinic geo re-evaluation (admin force-run) | Admin |
| GET | `/territories/unassigned-clinics` | Clinics with null or ambiguous territory | Admin, Manager |
| POST | `/clinics/:id/territory/unlock-geo` | Clear manual lock; allow geo reassignment | Admin |

**AC-TERR-35**  
WHEN a Manager calls territory APIs THEN they SHALL have read access to all list/detail/boundary GET endpoints. Managers MAY `PUT`/`DELETE` boundaries only on level-3 leaves that are descendants of territories in their `effectiveTerritoryIds`. Managers SHALL NOT create, reparent, deactivate territories, or override clinic territory assignments.

**AC-TERR-36**  
WHEN a Manager submits a boundary that overlaps another leaf outside their scope THEN the overlap check (AC-TERR-10) SHALL still apply globally — managers cannot create overlaps anywhere in the system.

---

## Design

### Data model

```prisma
model Territory {
  id              String      @id @default(cuid())
  name            String
  code            String      @unique   // auto-generated — see AC-TERR-01a
  level           Int         // 0=root, 1=region, 2=state, 3=leaf
  regionSlug      String?     // e.g. SE — set on level 1, inherited by descendants
  stateCode       String?     // e.g. SP — set on level 2, inherited by descendants
  parentId        String?
  parent          Territory?  @relation("TerritoryHierarchy", fields: [parentId], references: [id])
  children        Territory[] @relation("TerritoryHierarchy")
  // boundary: geometry(Geometry, 4326) — PostGIS column via SQL migration (see below)
  isActive        Boolean     @default(true)
  organizationId  String?     // nullable until multi-tenancy (Spec 00)
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  clinics         Clinic[]
  userAssignments UserTerritoryAssignment[]
  closureAsAncestor   TerritoryClosure[] @relation("ClosureAncestor")
  closureAsDescendant TerritoryClosure[] @relation("ClosureDescendant")

  @@unique([parentId, name])
  @@index([parentId])
  @@index([isActive])
}
```

**PostGIS column (SQL migration — not native Prisma type):**

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
ALTER TABLE territory ADD COLUMN boundary geometry(Geometry, 4326);
CREATE INDEX idx_territory_boundary ON territory USING GIST (boundary);
-- Optional clinic spatial index:
ALTER TABLE clinic ADD COLUMN location geometry(Point, 4326);
CREATE INDEX idx_clinic_location ON clinic USING GIST (location);
```

Boundary reads/writes use `ST_GeomFromGeoJSON` / `ST_AsGeoJSON` via `$queryRaw`.

```prisma
model TerritoryClosure {
  ancestorId    String
  descendantId  String
  depth         Int       // 0 = self, 1 = child, 2 = grandchild, ...
  ancestor      Territory @relation("ClosureAncestor", fields: [ancestorId], references: [id], onDelete: Cascade)
  descendant    Territory @relation("ClosureDescendant", fields: [descendantId], references: [id], onDelete: Cascade)

  @@id([ancestorId, descendantId])
  @@index([descendantId])
}

model Clinic {
  // ... existing fields ...
  territoryId                 String?
  territory                   Territory? @relation(fields: [territoryId], references: [id])
  territoryAssignmentStatus   TerritoryAssignmentStatus @default(unassigned)
  territoryAssignmentSource   TerritoryAssignmentSource @default(geo)
  lat                         Float?
  lng                         Float?
  // PostGIS point for spatial index (optional denormalization):
  // location geometry(Point, 4326)
  // ...
}

enum TerritoryAssignmentStatus {
  assigned
  unassigned
  ambiguous
}

enum TerritoryAssignmentSource {
  geo     // membership set by PostGIS geo assignment — may be recomputed
  manual  // set by admin approval — geo recompute skipped until unlock
}

model UserTerritoryAssignment {
  // ... existing fields — territoryId becomes FK to Territory.id ...
  userId       String
  territoryId  String
  assignedAt   DateTime @default(now())
  assignedBy   String
  user         User     @relation(fields: [userId], references: [id])
  territory    Territory @relation(fields: [territoryId], references: [id])

  @@unique([userId, territoryId])
}
```

### Scope resolution (updated F-008)

```typescript
interface ScopeContext {
  isGlobal: boolean;
  assignedTerritoryIds: string[];   // raw assignments from UserTerritoryAssignment
  effectiveTerritoryIds: string[];  // assigned + all descendants (from TerritoryClosure)
  clinicIds: string[];              // derived: SELECT id FROM clinic WHERE territory_id IN effectiveTerritoryIds
  managedUserIds: string[];         // MANAGER only
  segmentIds: string[];             // Spec 10 — added later
}

async function resolveEffectiveTerritoryIds(assignedIds: string[]): Promise<string[]> {
  // SELECT descendant_id FROM territory_closure WHERE ancestor_id IN assignedIds
  // UNION assignedIds
  // Filter to active territories only
}

async function assertClinicInScope(scope: ScopeContext, clinicId: string): Promise<void> {
  const clinic = await clinicRepo.findById(clinicId);
  if (!scope.isGlobal && !scope.effectiveTerritoryIds.includes(clinic.territoryId)) {
    throw forbidden();
  }
}
```

### Geo assignment algorithm (PostGIS)

Runs on: clinic create/update (when `source = geo`), registry ingest, boundary save, admin force recompute.

```sql
-- Assign clinic to exactly one leaf (called from application layer):
SELECT t.id
FROM territory t
WHERE t.is_active = true
  AND NOT EXISTS (SELECT 1 FROM territory c WHERE c.parent_id = t.id AND c.is_active = true)
  AND t.boundary IS NOT NULL
  AND ST_Covers(t.boundary, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326));
-- Expect exactly 1 row; 0 → unassigned; >1 → ambiguous (should not happen with overlap hard-block)
```

```
1. IF clinic.territoryAssignmentSource = 'manual' → skip auto assignment
2. IF lat/lng missing → territoryId = null, status = unassigned
3. Run PostGIS query above
4. IF count = 1 → set territoryId, status = assigned, source = geo
5. IF count = 0 → territoryId = null, status = unassigned
6. IF count > 1 → territoryId = null, status = ambiguous (log alert — indicates data integrity issue)
```

**Overlap detection on boundary save:**

```sql
SELECT t.id, t.code
FROM territory t
WHERE t.id != :territoryId
  AND t.is_active = true
  AND t.boundary IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM territory c WHERE c.parent_id = t.id AND c.is_active = true)
  AND ST_Intersects(t.boundary, ST_GeomFromGeoJSON(:newBoundary))
  AND NOT ST_Touches(t.boundary, ST_GeomFromGeoJSON(:newBoundary));
-- Any row → reject with 422
```

### Closure table maintenance

On any `parentId` change, territory create, or territory deactivate:

```
1. Rebuild closure rows for affected subtree
2. Invalidate Redis scope caches for users assigned to any ancestor of affected nodes
3. If boundaries changed → enqueue membership recompute job
```

### Boundary API (no map SDK)

| Concern | Decision |
|---------|----------|
| Input | GeoJSON `Polygon` or `MultiPolygon` in request body |
| Endpoint | `PUT /api/v1/territories/:id/boundary` |
| Storage | PostGIS `geometry(Geometry, 4326)` + GIST index |
| Validation | `ST_IsValid`, SRID 4326, hard-block overlaps (AC-TERR-10) |
| Who | Admin (any territory); Manager (leaf boundaries only, V1) |
| Output | `GET /territories/:id/boundary` returns GeoJSON via `ST_AsGeoJSON` |
| Deferred | Mapbox / web polygon draw UI — separate spec when needed |

### Transaction snapshots

```typescript
// Spec 06 — Order
interface Order {
  clinicId: string;
  territoryIdAtOrder: string;  // snapshot from clinic.territoryId at checkout
  // ...
}

// Spec 11 — Visit
interface Visit {
  clinicId: string;
  territoryIdAtVisit: string;  // snapshot from clinic.territoryId at visit save
  // ...
}
```

Analytics query for "Sudeste sales Q1":

```sql
SELECT SUM(o.total)
FROM "order" o
WHERE o.territory_id_at_order IN (
  SELECT descendant_id FROM territory_closure WHERE ancestor_id = :sudesteId
)
AND o.created_at BETWEEN :start AND :end;
```

### Migration from F-008 string IDs

1. Enable PostGIS extension: `CREATE EXTENSION IF NOT EXISTS postgis;`
2. Create `Territory` records matching existing string IDs (or map legacy IDs → new cuid with `code` preserving legacy value).
3. Add FK from `Clinic.territoryId` and `UserTerritoryAssignment.territoryId` to `Territory.id`.
4. Build initial closure table.
5. Run geo assignment batch for clinics with coordinates.
6. Remove acceptance of arbitrary string territory IDs on assignment APIs.

### Deferred (out of scope for Spec 37 V1)

- Web admin tree UI and map polygon editor — consume these APIs when built
- `POST /territories/:id/split` — optional; manual clinic migration + reparent is sufficient for first release if needed

### API examples

**Create state (level 2):**

```http
POST /api/v1/territories
{ "name": "São Paulo", "level": 2, "parentId": "<BR-SE id>", "stateCode": "SP" }
→ { "id": "...", "code": "BR-SE-SP", "level": 2, ... }
```

**Submit leaf boundary:**

```http
PUT /api/v1/territories/{id}/boundary
Content-Type: application/json
{
  "type": "Polygon",
  "coordinates": [[[-46.70, -23.55], [-46.60, -23.55], [-46.60, -23.50], [-46.70, -23.50], [-46.70, -23.55]]]
}
→ 200 | 422 (overlap with [{ "id", "code": "BR-SE-SP-02" }])
```

**Analytics roll-up (Spec 25 consumes this):**

```http
GET /api/v1/territories/{sudesteId}/rollup?metric=order_total&from=2026-01-01&to=2026-03-31
→ { "territoryCode": "BR-SE", "orderTotal": 1250000.00, "clinicCount": 842, ... }
```

*(Roll-up endpoint may be implemented in Spec 25; query pattern defined here uses `territory_closure` + snapshotted order fields.)*

### Error & edge cases

| Scenario | Behaviour |
|----------|-----------|
| Deactivate territory with assigned clinics | Block deactivation until clinics are reassigned or territory is reparented/merged |
| Deactivate territory with assigned users | Block deactivation until assignments removed or migrated |
| Reparent leaf under another leaf | Allowed if new parent becomes non-leaf; former leaf's clinics stay on it |
| Delete root with entire tree | Soft-deactivate only; cascade requires empty tree |
| Clinic moved after orders placed | Historical orders keep `territoryIdAtOrder`; current `Clinic.territoryId` updated |
| User assigned to leaf + parent overlap | `effectiveTerritoryIds` is a set union — no double-counting |
| No PostGIS extension available | Migration fails fast with clear error; PostGIS is a hard dependency |
| Registry ingest without coordinates | Clinic remains `unassigned`; cadastro health (Spec 17) penalizes missing geo |

### Integration with Spec 21 (approval)

Manual clinic territory override (AC-TERR-22) creates:

```typescript
{
  requestType: 'territory_reassignment',
  entityType: 'clinic',
  entityId: clinicId,
  payload: { fromTerritoryId, toTerritoryId, reason },
  reviewer: 'ADMIN'  // per Spec 21 table
}
```

On approval: update `Clinic.territoryId`, set `territoryAssignmentSource = 'manual'` and `territoryAssignmentStatus = 'assigned'`, audit log, invalidate caches. Geo recompute will not overwrite until `POST /clinics/:id/territory/unlock-geo`.

---

## Implementation sequencing (backend only)

```
Phase 1 — PostGIS + data model
  Enable PostGIS, Territory + TerritoryClosure tables, boundary geometry column, Clinic FK migration

Phase 2 — Territory CRUD API
  Create, reparent, deactivate, tree list, code validation (BR-SE-SP-01)

Phase 3 — Boundary API
  PUT/GET/DELETE boundary, overlap hard-block, GIST index

Phase 4 — Scope resolver update
  effectiveTerritoryIds expansion, Redis cache invalidation, F-008 API FK validation

Phase 5 — Geo membership engine
  ST_Contains assignment, unassigned-clinics endpoint, batch recompute job, unlock-geo endpoint

Phase 6 — Spec 21 integration
  territory_reassignment approval → territoryAssignmentSource = manual

Phase 7 — Snapshot fields (when Spec 06 / 11 ship)
  territoryIdAtOrder, territoryIdAtVisit
```

**Blocks:** Spec 10, Spec 11, Spec 05.  
**Does not block:** Current F-008 string-based scope (continues until migration).

---

## Resolved decisions

| # | Decision |
|---|----------|
| 1 | **Overlap policy:** Hard-block on boundary save (AC-TERR-10) |
| 2 | **Code format:** `BR-{region}-{state}-{seq}` for leaves — e.g. `BR-SE-SP-01` |
| 3 | **Spatial engine:** PostGIS from day one (GIST index, ST_Contains, ST_Intersects) |
| 4 | **Manual assignment lock:** `territoryAssignmentSource = 'manual'` after approved override; geo recompute skipped until admin calls `unlock-geo` (replaces earlier `manual_hold` concept) |
| 5 | **Manager boundaries:** Managers MAY submit boundaries via API in V1 (AC-TERR-35) |
| 6 | **Map UI:** Deferred — no Mapbox or third-party map SDK in this spec |
| 7 | **Hierarchy:** 4 fixed levels (BR → region → state → leaf patch) |
| 8 | **Code:** Auto-generated, immutable; pattern per level (AC-TERR-01a) |
| 9 | **Point assignment:** `ST_Covers` (includes boundary edge) |
| 10 | **Admin clinic override:** Direct in V1 (`PATCH /clinics/:id/territory`); managers use Spec 21 |
| 11 | **Single root:** One `BR` level-0 node per org (single-tenant MVP) |

---

## Remaining open questions (optional — confirm before build)

| # | Question | Default if unanswered |
|---|----------|----------------------|
| A | Seed the five macro-regions (`BR-N`, `BR-NE`, …) via migration or admin creates manually? | Seed script in migration |
| C | Implement `POST /territories/:id/split` in V1 or defer? | Defer — manual migration workflow |

---

## Linear tickets (proposed)

| Ticket | Type | Title |
|--------|------|-------|
| ATLAS-TBD | Parent | Spec 37: Territory Management |
| ATLAS-TBD | BE | PostGIS migration — Territory, closure, boundary geometry, Clinic FK |
| ATLAS-TBD | BE | Territory CRUD API + code format validation |
| ATLAS-TBD | BE | Boundary API — GeoJSON in, overlap hard-block, membership recompute job |
| ATLAS-TBD | BE | Scope resolver — effectiveTerritoryIds + cache invalidation |
| ATLAS-TBD | BE | Geo membership engine + unassigned clinics + unlock-geo |
| ATLAS-TBD | BE | Spec 21 territory_reassignment integration |
