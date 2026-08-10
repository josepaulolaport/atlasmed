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
- `dashboard`, `maps`, `potential`, `search-sync`, `sessions`, `user`, `visits`.


## Mobile Architecture

- Flutter app under `apps/mobile` (Explore, facility detail / person roster, orders-related surfaces).
- ADR 0002 (React Native/Expo) remains **Proposed**; Flutter is the implemented client.

## Data Architecture

### Schemas

PostgreSQL named schemas in use:

- `public` — CRM and operational data (users, sessions, facilities, persons / person_facilities, territories, catalog, orders, field suggestions, cadastro, CNES lookup catalogs, etc.).
- `audit` — `audit_logs` compliance trail.

There is **no** `registry` or `ingestion` schema. CNES FTP/archive warehouse ingest and registry READ/confirm were removed. Public CNES lookup tables and `facilities.cnes_code` remain. Do not reintroduce a registry warehouse without a new ADR and product decision.

### Geometry

PostGIS is enabled. Geographic data uses PostGIS geometry columns:

- `facilities.location` — `geometry(Point, 4326)`.
- `territories.boundary` — `geometry(MultiPolygon, 4326)`.
- `territories.centroid` — `geometry(Point, 4326)`.

Spatial queries use raw `sql` tagged templates via Drizzle's `db.execute()` where needed.

### ORM

Drizzle ORM with Drizzle Kit for migrations. Schema files live in `packages/database/src/schema/`. Generated migrations live in `packages/database/drizzle/`. Prefer `generate` + `migrate` always; gated `db:push` only on disposable local DB names — see root `AGENTS.md` § HARD SAFETY / `packages/database`.

## Cadastro documents

Facility cadastro uses versioned **submissions** with logical **documents** (catalogued in `conformity_requirements`) and ordered **file assets** in private object storage. Clients upload via signed URLs (PUT / multipart). Ops review is manual per logical document.

⚠️ **As-built, file processing runs inline on the API request thread**, not in the Temporal
workflow — `cadastroFileUploadedWorkflow` exists and is fired best-effort, so both paths can
write the same row. Being replaced by [Spec 0011](../specs/0011-cadastro-pipeline/requirements.md).

## Current Gaps

- Visit/activity domain is early / incomplete; nothing meaningful populates `visits` or
  `interactions` yet, so no activity metric is currently derivable.
- Mobile stack migration (Flutter → React Native/Expo) not decided for production (ADR 0002 Proposed).
- `apps/web` is abandoned and knowingly broken — see root `AGENTS.md`.
- Several catalogs (`unit_types`, `unit_subtypes`, `clinical_focuses`, `occupations`,
  `healthcare_specialties`) have **no write path in code** and are populated manually.
