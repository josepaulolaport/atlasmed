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
│   ├── database/      # Prisma schema, migrations, generated client
│   ├── observability/ # OpenTelemetry/logger utilities
│   └── ui/            # Shared UI package placeholder
```

## Backend

The backend is a TypeScript API using Bun and ElysiaJS. It has PostgreSQL via Prisma, Redis, BullMQ jobs, OpenAPI/Swagger, structured errors, request observability, health checks, and security middleware.

Implemented backend modules:

- `access`: authentication, sessions, invitations, verification, RBAC, grants, scopes, 2FA, audit, and user management.
- `clinic`: clinic CRUD and doctor-clinic association workflows.
- `doctor`: doctor CRUD.
- `registry-ingestion`: ingestion runs and suggestions for external registry changes.

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

The Prisma schema currently includes:

- Users, roles, sessions, invitations, password resets, verification tokens, permissions, audit logs.
- User territory assignments.
- Clinics, doctors, doctor-clinic associations.
- Registry ingestion runs and ingestion suggestions.

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

The current branch is `feature/clinic-doctor` and the worktree contains uncommitted changes around clinic, doctor, registry ingestion, web pages, and generated Prisma files. Documentation work should avoid modifying those implementation files unless explicitly requested.
