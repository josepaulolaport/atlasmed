# Current State

## Repository Shape

Atlasmed is currently a monorepo with backend, web, mobile, and shared packages.

```text
atlasmed/
├── apps/
│   ├── api/      # Bun + Elysia backend API
│   ├── web/      # Next.js web app
│   └── mobile/   # Flutter starter app
├── packages/
│   ├── access/        # Shared auth/access contracts, permissions, schemas
│   ├── config/        # Shared environment schemas
│   ├── database/      # Drizzle schema, migrations, database client factory
│   ├── observability/ # OpenTelemetry/logger utilities
│   └── ui/            # Shared UI package placeholder
```

## Backend

The backend is a TypeScript API using Bun and ElysiaJS. It has PostgreSQL + PostGIS via Drizzle ORM, Redis, BullMQ jobs, Temporal workflows, OpenAPI/Swagger, structured errors, request observability, health checks, and security middleware.

Implemented backend modules:

- `access`: authentication, sessions, invitations, verification, RBAC, grants, scopes, 2FA, audit, and user management.
- `facility`: facilities, professionals, facility-professional associations, conformity requirements and records.
- `territory`: territory types, hierarchy, spatial assignment, approval workflows.
- `catalog`: products.
- `ingestion`: ingestion runs, diffs, suggestions.
- `registry-ingestion`: ingestion runs and suggestions for external CNES registry changes.

## Web App

The web app is a Next.js 16 application with Tailwind CSS 4, Radix UI, Axios API clients, React Hook Form, and Zod validation.

Implemented web areas include:

- Auth pages: login, 2FA login, register, forgot password, reset password.
- Dashboard shell and protected routes.
- User management and invitations.
- Profile and security pages.
- Session management.
- Health dashboard.
- Clinics, doctors, clinic detail, and registry suggestions pages.

## Mobile App

The current mobile app is a Flutter starter. This does not match the current target preference of React Native/Expo and requires an explicit architecture decision before production mobile work continues.

## Database

ORM: Drizzle. Schema files live in `packages/database/src/schema/`. Migrations are managed by Drizzle Kit.

PostgreSQL schemas in use:

- `public` — CRM and operational data.
- `registry` — CNES registry warehouse.

Current Drizzle schema includes:

- `public`: users, roles, sessions, invitations, password resets, verification tokens, permissions.
- `public`: territories, territory closure, territory assignments, territory approval requests.
- `public`: facilities (PostGIS `Point` location), professionals, associations, conformity requirements and records.
- `public`: catalog products, ingestion runs, ingestion diffs, ingestion suggestions.
- `registry`: raw CNES facility records (PostGIS `Point` location).

Not yet present as first-class models:

- Organizations/tenants.
- Visits, activities, tasks, follow-ups, reminders.
- Territories as rich domain records.
- AI conversations, AI tool calls, AI governance policies.
- Notification preferences and delivery history.
- Analytics snapshots or business metric facts beyond observability logs.

## Documentation Already Present

Root-level status and implementation docs exist, including API endpoints, setup, implementation summaries, auth hardening plans, email/SMS status, frontend-backend sync notes, and QuestDB setup docs. Some docs predate `/api/v1` versioning and should be consolidated or marked historical.

## Worktree Note

The current branch is `refactor/prisma-to-drizzle-20260709`. This branch completed the full migration from Prisma to Drizzle ORM, including schema rewrites, repository migrations, infrastructure rewrites, test utility updates, and removal of all Prisma artifacts.
