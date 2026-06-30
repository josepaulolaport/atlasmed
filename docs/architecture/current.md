# Current Architecture

## Overview

Atlasmed currently uses a TypeScript monorepo with a Bun/Elysia backend, a Next.js web app, a Flutter mobile starter, and shared packages for access control, database, config, observability, and UI.

## Backend Runtime

- Runtime: Bun.
- Framework: ElysiaJS.
- API docs: OpenAPI/Swagger.
- Database: PostgreSQL through Prisma.
- Cache/ephemeral state: Redis.
- Jobs: BullMQ.
- Logging/observability: Pino, OpenTelemetry utilities, Prometheus metrics, optional QuestDB logging.

## Backend Module Boundaries

- `access`: identity, users, roles, sessions, invitations, verification, 2FA, permissions, scopes.
- `clinic`: clinics and facility-professional associations.
- `doctor`: doctors.
- `registry-ingestion`: external registry ingestion and suggestion workflows.

## Web Architecture

- Next.js App Router.
- Route groups for auth and dashboard.
- API client modules under `apps/web/lib/api`.
- Role/permission helpers under `apps/web/lib/permissions.ts`.
- Reusable UI components under `apps/web/components/ui`.

## Data Architecture

The current data model is centered on access/security plus early healthcare relationship data. Tenant isolation is not yet represented by an `Organization` or equivalent top-level tenant model.

## Current Gaps

- No explicit multi-tenant organization model.
- Roles are currently `ADMIN`, `MANAGER`, and `USER`; doctor and clinic actors are not yet first-class roles.
- Territory records are not modeled beyond assignment IDs and scope logic.
- No task/follow-up/reminder domain yet.
- No visit/activity domain yet.
- No AI assistant domain yet.
- No production mobile architecture decision yet.
