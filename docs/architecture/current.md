# Current Architecture

## Overview

Atlasmed is a TypeScript monorepo with a Bun/Elysia backend, a Flutter mobile app, Temporal workers, and shared packages for access control, database, config, observability, Mapbox, and facility insights.

## Backend Runtime

- Runtime: Bun.
- Framework: ElysiaJS.
- API docs: OpenAPI/Swagger.
- Database: PostgreSQL + PostGIS through Drizzle ORM.
- Cache/ephemeral state: Redis.
- Jobs: BullMQ.
- Background workflows: Temporal (`apps/workers/temporal`, package `@atlasmed/temporal-worker`, default queue `atlasmed-workflows`).
- Logging/observability: structured logger, OpenTelemetry utilities, Prometheus metrics.
- Search: Meilisearch (facility and persons indexes; rebuild via search-sync workflows).

## Backend Module Boundaries

- `access`: identity, users, roles, sessions, invitations, verification, 2FA, scopes. (The `permissions` table was dropped in `0073_drop_permissions_access_grants.sql` — authorization is role + territory + vertical only.)
- `facility`: facilities, consultant assignments, cadastro submissions, conformity; HTTP adapters for person–facility projections.
- `person`: persons, healthcare/admin facility projections, notes, user–person relationships, Explorar list/specialties.
- `territory`: territory types, hierarchy, spatial assignment (manager approve flow removed).
- `catalog`: products.
- `orders`: orders linked to facilities (and optionally `person_id`).
- `field-suggestions`: user-submitted Não Conformidades (`field_suggestions`).
- `dashboard`: Desempenho metrics and the Equipe roster (spec 0014). One endpoint per
  metric under `/dashboard/metrics/*`, each taking the same scope + filter parameters and
  each with a per-clinic breakdown at `/dashboard/metrics/:metric/clinics`; plus
  `/dashboard/territory` and `/team`. `GET /dashboard/summary` is **gone** — it blocked on
  its slowest query and returned an unbounded cross-vertical aggregate to every ADMIN.
- `maps`, `potential`, `search-sync`, `sessions`, `user`, `visits`.

### Dashboard scoping

Every metric pins **exactly one vertical** and derives its denominator from the subject's
role, not from `scope.facilityIds`: REP → clinics assigned to them, MANAGER → clinics in
their zones, ADMIN/OPS → the whole vertical. `subjectUserId` re-scopes to another person
(MANAGER may target their own reps only, ADMIN anyone), which is what backs the mobile
"Ver desempenho" entry from a profile. This is where `analyticsFacilityIds`,
`analyticsEffectiveTerritoryIds` and `reportAssignedTerritoryIds` stop being dead code.

`GET /facilities/unit-types` exposes the unit-type catalog with its subtypes so the
`unit_type` filter has resolvable names (spec 0014 item 14). Both tables are empty in
production, so the filter currently renders with no options.


## Mobile Architecture

- Flutter app under `apps/mobile` (Explore, facility detail / person roster, orders-related surfaces).
- **`Administração` (`/admin`, drawer branch 12, ADMIN-only)** is the reference-data
  surface: produtos, produtos concorrentes, métricas, fontes pagadoras and the
  support catalogues (spec 0016). It replaced `/catalog`, which held the admin
  catalogue and which nothing in the app linked to. The rep-facing product
  surfaces are `/products` and its peer tab `/price-index`.
- The user-facing product routes (`/products`, `/products/:familyId`) read the API-backed catalog through `CatalogRepository` and Riverpod's `catalogFamiliesProvider`; no local product fixture is used. The route opens a product family from any of its variant IDs, preserving deep links if the API reorders presentations.
- ADR 0002 (React Native/Expo) remains **Proposed**; Flutter is the implemented client.

## Data Architecture

### Schemas

PostgreSQL named schemas in use:

- `public` — CRM and operational data (users, sessions, facilities, persons / person_facilities, territories, catalog, orders, field suggestions, cadastro, CNES lookup catalogs, etc.).
- `audit` — `audit_logs` compliance trail.
- `registry` — read-only mirror of the monthly CNES export, scoped to clinics we operate. Loaded by the ingestion worker; never written by the application. ADR 0006, narrowed; ADR 0009.
- `ingestion` — one table, `cnes_runs`: the ingestion run ledger. Not the diff/suggestion warehouse that was deleted in `a3e32ac5`, and that is not coming back.

The registry resolves to `public` by **join, never by a stored link**: `registry.professionals.cnes_id` = `person_healthcare_profiles.cnes_professional_id`, measured at 100 % coverage against the 202605 export. A reload therefore changes the answer with no migration and no relink step.

### Geometry

PostGIS is enabled. Geographic data uses PostGIS geometry columns:

- `facilities.location` — `geometry(Point, 4326)`.
- `territories.boundary` — `geometry(MultiPolygon, 4326)`.
- `territories.centroid` — `geometry(Point, 4326)`.

Spatial queries use raw `sql` tagged templates via Drizzle's `db.execute()` where needed.

### ORM

Drizzle ORM with Drizzle Kit for migrations. Schema files live in `packages/database/src/schema/`. Generated migrations live in `packages/database/drizzle/`. Prefer `generate` + `migrate` always; gated `db:push` only on disposable local DB names — see root `AGENTS.md` § HARD SAFETY / `packages/database`.

## Cadastro documents

Facility cadastro uses versioned **submissions** with logical **documents** (catalogued in `conformity_requirements`) and ordered **file assets** in private object storage.

The requirement catalogue is seeded by migration `0089` (five documents, scoped to
Ortopedia) and had **no write path** until spec 0016 §4.7 added one at
`Administração › Requisitos de cadastro` — before that, changing the checklist
meant writing a migration.

⚠️ `atlasmed_prod_snapshot` on the local Postgres is **32 migrations stale** (86
of 118). Counting rows in it without checking `drizzle.__drizzle_migrations`
gives confidently wrong answers — it reports this table as empty. Clients upload via signed URLs (PUT / multipart). Ops review is manual per logical document.

⚠️ **As-built, file processing runs inline on the API request thread**, not in the Temporal
workflow — `cadastroFileUploadedWorkflow` exists and is fired best-effort, so both paths can
write the same row. Being replaced by [Spec 0011](../specs/0011-cadastro-pipeline/requirements.md).

## Current Gaps

- Visit/activity domain is early / incomplete; nothing meaningful populates `visits` or
  `interactions` yet, so no activity metric is currently derivable.
- Mobile stack migration (Flutter → React Native/Expo) not decided for production (ADR 0002 Proposed).
- `unit_types`, `unit_subtypes` and `occupations` have **no write path in code**
  and are populated from CNES. Deliberate — a human-editable copy of an official
  catalogue is a divergence waiting to happen (spec 0016 §2.3).
- `healthcare_specialties`, `clinical_focuses`, `person_facility_roles` and
  `person_professional_registration_councils` gained `POST`/`PATCH` on the
  `CATALOG` subject with spec 0016 §5.2, edited from
  `Administração › Catálogos`. `healthcare_specialties.cnes_id` became nullable
  in migration `0118` so a specialty CNES does not list can be registered without
  inventing an official id; its plain `UNIQUE` is kept rather than swapped for a
  partial index, because NULLs are already distinct under one and a partial index
  cannot be inferred as an `ON CONFLICT` arbiter — which would break any future
  CNES sync upserting on `cnes_id`.
