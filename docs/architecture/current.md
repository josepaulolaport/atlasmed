# Current Architecture

## Overview

Atlasmed is a TypeScript monorepo with a Bun/Elysia backend, a Next.js web app, a Flutter mobile starter, and shared packages for access control, database, config, observability, and UI.

## Backend Runtime

- Runtime: Bun.
- Framework: ElysiaJS.
- API docs: OpenAPI/Swagger.
- Database: PostgreSQL + PostGIS through Drizzle ORM.
- Cache/ephemeral state: Redis.
- Jobs: BullMQ.
- Background workflows: Temporal.
- Logging/observability: Pino, OpenTelemetry utilities, Prometheus metrics.

## Backend Module Boundaries

- `access`: identity, users, roles, sessions, invitations, verification, 2FA, permissions, scopes.
- `facility`: facilities, professionals, facility-professional associations, conformity requirements and records.
- `territory`: territory types, territory hierarchy, spatial assignment, approval workflows.
- `catalog`: products.
- `ingestion`: ingestion runs, diffs, suggestions.
- `registry-ingestion`: external CNES registry ingestion and suggestion workflows.

## Web Architecture

- Next.js App Router.
- Route groups for auth and dashboard.
- API client modules under `apps/web/lib/api`.
- Role/permission helpers under `apps/web/lib/permissions.ts`.
- Reusable UI components under `apps/web/components/ui`.

## Data Architecture

### Schemas

The PostgreSQL database uses two named schemas:

- `public` — CRM and operational data (users, sessions, facilities, territories, catalog, ingestion).
- `registry` — CNES registry warehouse (raw external registry records).

### Geometry

PostGIS is enabled. All geographic data uses PostGIS geometry columns — no separate lat/lng float fields:

- `facilities.location` — `geometry(Point, 4326)`.
- `territories.boundary` — `geometry(MultiPolygon, 4326)`.
- `territories.centroid` — `geometry(Point, 4326)`.
- `registry_facilities.location` — `geometry(Point, 4326)`.

Spatial queries use raw `sql` tagged templates via Drizzle's `db.execute()`.

### ORM

Drizzle ORM with Drizzle Kit for migrations. Schema files live in `packages/database/src/schema/`. Generated migrations live in `packages/database/drizzle/`.

## Cadastro documents

Facility cadastro uses versioned **submissions** with logical **documents** (catalogued in `conformity_requirements`) and ordered **file assets** in private object storage. Clients upload via signed URLs (PUT / multipart); Temporal runs `cadastroFileUploadedWorkflow` for checksum/MIME validation. Ops review is manual per logical document. See `docs/specs/0004-cadastro-submissions/design.md`.

## Current Gaps

- No explicit multi-tenant organization model.
- No visit/activity domain yet.
- No AI assistant domain yet.
- No production mobile architecture decision yet (Flutter starter present; React Native/Expo preferred per ADR 0002).
