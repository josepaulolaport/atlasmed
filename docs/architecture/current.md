# Current Architecture

## Overview

Atlasmed is a TypeScript monorepo with a Bun/Elysia backend, a Next.js web app, a Flutter mobile app, and shared packages for access control, database, config, observability, and UI.

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
- `calendar`: personal blocks, interaction scheduling, recurrence, per-occurrence overrides, availability, and conflict detection.
- `interactions`: per-occurrence commercial lifecycle, linked orders, compatibility visits, transition history, and overdue processing.
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

Drizzle ORM with Drizzle Kit for migrations. Schema files live in `packages/database/src/schema/`. Generated migrations live in `packages/database/drizzle/`. Prefer `generate` + `migrate` always; gated `db:push` only on disposable local DB names — see root `AGENTS.md` § HARD SAFETY / `packages/database`.

## Cadastro documents

Facility cadastro uses versioned **submissions** with logical **documents** (catalogued in `conformity_requirements`) and ordered **file assets** in private object storage. Clients upload via signed URLs (PUT / multipart); Temporal runs `cadastroFileUploadedWorkflow` for checksum/MIME validation. Ops review is manual per logical document. See `docs/specs/0004-cadastro-submissions/design.md`.

## Calendar and Interactions

The delivered Calendar/Interactions domain supports personal blocks and in-person or remote facility contacts. It includes timezone-aware recurrence, last-day clamping, per-occurrence overrides and interaction state, overlap checks, optimistic versions, and idempotent commands.

Representatives manage their own agenda and interaction lifecycle. Managers have scoped read-only visibility into managed representatives, with private block titles redacted. The Flutter app provides the agenda, editor, and attendance workspace; the web app does not expose this domain.

A BullMQ job persists overdue scheduled interactions as `NOT_COMPLETED`. Completed interactions create one compatibility `visits` ledger row for existing consumers. See [Calendar and Commercial Interactions](features/calendar-interactions.md).

Per owner instruction, migrations were intentionally not generated in the delivery branch. Migration generation, SQL/metadata review, the pending overlap exclusion, `db:migrate`, and `drizzle-kit check` are required before merge or deployment.

## Current Gaps

- No explicit multi-tenant organization model.
- Calendar/Interactions still depends on `visits` as a compatibility ledger for completed interactions and existing metrics.
- Calendar overlap protection is serialized by owner in the API, but the database exclusion constraint remains a required migration gate.
- No AI assistant domain yet.
- No production mobile architecture decision yet (Flutter app present; React Native/Expo preferred per ADR 0002).
