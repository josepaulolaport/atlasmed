# Current Architecture

## Overview

Atlasmed is a TypeScript monorepo with a Bun/Elysia backend, a Next.js web app, a Flutter mobile app, Temporal workers, and shared packages for access control, database, config, observability, Mapbox, and facility insights.

## Backend Runtime

- Runtime: Bun.
- Framework: ElysiaJS.
- API docs: OpenAPI/Swagger.
- Database: PostgreSQL + PostGIS through Drizzle ORM.
- Cache/ephemeral state: Redis.
- Jobs: BullMQ.
- Background workflows: Temporal (`apps/workers/temporal`, package `@atlasmed/temporal-worker`, default queue `atlasmed-workflows`).
- Logging/observability: structured logger, OpenTelemetry utilities, Prometheus metrics.
- Search: Meilisearch (facility and professional indexes; rebuild via search-sync workflows).

## Backend Module Boundaries

- `access`: identity, users, roles, sessions, invitations, verification, 2FA, permissions, scopes.
- `facility`: facilities, facility–professional associations, facility representatives, consultant assignments, cadastro submissions, conformity.
- `professional`: professionals, professional notes, user–professional relationships.
- `territory`: territory types, hierarchy, spatial assignment, approval workflows.
- `catalog`: products.
- `orders`: orders linked to facilities (and optionally professionals).
- `field-suggestions`: user-submitted Não Conformidades (`field_suggestions`).
- `dashboard`, `maps`, `potential`, `search-sync`, `sessions`, `user`, `visits`.

## Web Architecture

- Next.js App Router.
- Route groups for auth and dashboard.
- API client modules under `apps/web/lib/api`.
- Role/permission helpers under `apps/web/lib/permissions.ts`.
- Reusable UI components under `apps/web/components/ui`.
- UI language: pt-BR.

## Mobile Architecture

- Flutter app under `apps/mobile` (Explore, facility detail, professionals, orders-related surfaces).
- ADR 0002 (React Native/Expo) remains **Proposed**; Flutter is the implemented client.

## Data Architecture

### Schemas

PostgreSQL named schemas in use:

- `public` — CRM and operational data (users, sessions, facilities, professionals, territories, catalog, orders, field suggestions, cadastro, CNES lookup catalogs, etc.).
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

Facility cadastro uses versioned **submissions** with logical **documents** (catalogued in `conformity_requirements`) and ordered **file assets** in private object storage. Clients upload via signed URLs (PUT / multipart); Temporal runs `cadastroFileUploadedWorkflow` for checksum/MIME validation. Ops review is manual per logical document. See `docs/specs/0004-cadastro-submissions/design.md`.

## Current Gaps

- No explicit multi-tenant organization model.
- Visit/activity domain is early / incomplete relative to product vision.
- No AI assistant domain yet.
- Mobile stack migration (Flutter → React Native/Expo) not decided for production (ADR 0002 Proposed).
