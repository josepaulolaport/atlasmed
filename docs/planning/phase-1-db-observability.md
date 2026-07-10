# Phase 1 — Database Schema & Observability

**Goal:** Get the data model right and get real visibility into what the system is doing.  
**Rule:** Schema changes here. No new API routes or web pages. No feature work.  
**Status:** 🟡 Part A (DB) complete — Part B (Observability) pending

> **Note:** Part C (Environment Setup, Docker Compose, MinIO, Meilisearch, ClickHouse) has been moved to its own **Phase 0.5 — Infrastructure** (`phase-0.5-infrastructure.md`). Part B below focuses purely on OTEL wiring, structured logging, and business spans.

This phase requires a design conversation before execution. The checkboxes below are the known mechanical work. The schema decisions section is where that conversation happens.

---

## Part A — Database Schema

### Schema architecture (DECIDED & IMPLEMENTED ✅)

Four PostgreSQL schemas. One ClickHouse cluster (SigNoz, for observability only).

```
PostgreSQL (atlasmed)
├── public     → business entities: facilities, professionals, territories, users,
│               catalog, sessions, permissions, invitations
├── audit      → compliance trail: audit_logs, immutable
├── registry   → CNES warehouse: append-only, written by Temporal worker
└── ingestion  → pipeline workflow: cnes_runs, cnes_diffs, cnes_suggestions
                 (extensible: add ans_*, tiss_* as new sources arrive)

ClickHouse (SigNoz stack)
└── signoz_* → operational observability: traces, logs, metrics
              → NEVER put business or compliance data here
              → SigNoz owns this schema; it breaks on upgrades
```

**ORM:** Drizzle (migrated from Prisma — complete ✅)  
**Naming:** snake_case throughout all DB identifiers ✅  
**Migration tooling:** `drizzle-kit generate` + `scripts/migrate.ts` ✅

**Why keep `audit` in PostgreSQL and not ClickHouse:**
- LGPD compliance requires strong consistency and immutability (ClickHouse is eventually consistent)
- Compliance queries are join-heavy across User/Facility entities — PostgreSQL handles this well
- Data sovereignty is simpler to certify in one cluster
- Table partitioning by month handles B2B CRM volume (thousands/day, not millions)
- Migrating to dedicated ClickHouse later is straightforward if volume demands it

**What `audit` schema contains:**
- `audit_logs` — moved from `crm`, partitioned by `created_at` month

**Migration plan:**
- Add `audit` to `datasource.schemas` in Prisma
- Move `AuditLog` model to `@@schema("audit")`
- Add monthly range partitioning on `audit_logs(created_at)` via raw SQL in migration
- Drop `AuditLog` from `crm` schema

### Known gaps to resolve

Work through each item below. For each one, make an explicit decision: **build**, **remove**, or **defer**.

#### 1. Organization / multi-tenancy

`Territory.organizationId` is a plain string FK with no `Organization` model behind it. This is a placeholder for multi-tenancy.

- [ ] **Decision:** Build `Organization` model now / defer / remove the FK
- [ ] If build: define the model (name, slug, plan, status, created), add FK relations on Territory and User, create migration
- [ ] If defer: add a comment to the schema noting this is a planned FK and leave it
- [ ] If remove: drop the column, create migration

#### 2. Missing FK relations (plain string IDs with no Prisma relation)

These exist in the schema but are plain strings, not proper relations. This blocks join queries and causes type safety holes.

| Field | Should relate to |
|---|---|
| `FacilityConsultantAssignment.userId` | `User` |
| `ConformityRecord.validatedByUserId` | `User` |
| `FacilityProfessional.confirmedByUserId` | `User` |
| `FacilityProfessional.endedByUserId` | `User` |
| `TerritoryApprovalRequest.requesterId` | `User` |
| `TerritoryApprovalRequest.reviewerId` | `User` |
| `Permission.grantedBy` | `User` |

- [ ] **Decision for each field:** add proper `@relation` / leave as string / remove
- [ ] Create migration for approved changes

#### 3. Visit domain

CASL subject `VISIT` exists. Permissions and tests are defined. There is no Prisma `Visit` model and no API module.

- [ ] **Decision:** Build Visit domain now / defer / remove VISIT from `packages/access`
- [ ] If remove: delete VISIT from abilities, subjects, and tests in `packages/access`
- [ ] If defer: document expected model shape here so the next person doesn't have to guess

**Expected Visit model shape (draft — confirm before building):**
```
Visit {
  id          String
  facilityId  String → Facility
  userId      String → User (the rep who made the visit)
  date        DateTime
  notes       String?
  outcome     VisitOutcome (enum: CONTACTED, NO_SHOW, FOLLOW_UP, CLOSED)
  createdAt   DateTime
  updatedAt   DateTime
}
```

#### 4. OPS role completion

OPS exists in enum and migration. It has CASL read permissions. Its scope resolver returns an empty set, so it can't actually see anything.

- [ ] **Decision:** Implement OPS fully / remove it
- [ ] If implement:
  - [ ] Define what OPS should see (likely: all facilities/professionals read-only, no territory or user management)
  - [ ] Add OPS to `ROLE_PRIORITY` in `packages/access`
  - [ ] Implement OPS scope resolver (likely: same as ADMIN read path, no territory filter)
  - [ ] Add OPS to seed data
- [ ] If remove:
  - [ ] Remove from `UserRole` enum in schema
  - [ ] Remove from `packages/access` abilities
  - [ ] Create migration to drop the enum value (careful: needs `ALTER TYPE` in Postgres)

#### 5. FacilityRepresentative.relationshipLevel type mismatch

This field is typed as `String` but a `RelationshipLevel` enum exists elsewhere in the CRM.

- [ ] **Decision:** Change to enum / leave as string
- [ ] If enum: add `relationshipLevel RelationshipLevel?` to `FacilityRepresentative`, create migration

#### 6. IngestionDiff — written but never read

`IngestionDiff` records are created by the Temporal worker reconcile step. No API route reads them.

- [ ] **Decision:** Build read API for IngestionDiff / remove the model
- [ ] If build: add to Phase 4 feature list as "Ingestion diff viewer"
- [ ] If remove: drop model and migration, remove worker write code

#### 7. Registry schema — unused tables

The following registry warehouse tables are loaded by the ingestion pipeline but never queried by any API:

- `RegistryEquipmentCatalog`, `RegistryEquipmentCategory`, `RegistryFacilityEquipment`
- `RegistryFacilityService`, `RegistryServiceClassification`, `RegistryServiceSpecialty`
- `RegistryMaintainer`, `RegistryFacilityAgreement`, `RegistryAgreementType`
- `RegistryPhysicalInstallation`, `RegistryPhysicalInstallationType`, `RegistryFacilityPhysicalInstallation`, `RegistryInstallationSubtype`
- `RegistryCareType`, `RegistryDeactivationReason`

- [ ] **Decision for each group:** expose via API (add to Phase 4) / keep in warehouse only (no action) / remove from schema
- [ ] Document the decision per table group

#### 8. Territory geo fields

`Territory` has bbox fields (`boundaryMinLng`, `boundaryMinLat`, etc.) but no PostGIS geometry column in the Prisma schema. PostGIS queries likely use raw SQL.

- [ ] Confirm whether PostGIS geometry columns exist (check via `prisma db pull` or direct DB inspection)
- [ ] If geometry columns exist outside Prisma schema: document them and decide whether to add as `Unsupported("geometry")`
- [ ] If not: no action needed

---

### Migration checklist

After all decisions are made:

- [ ] All schema changes collected into one or more migrations with meaningful names
- [ ] Migrations run cleanly on a fresh DB (`prisma migrate reset`)
- [ ] Prisma client regenerated (`prisma generate`)
- [ ] `packages/database` types verified in all consumers

---

## Part B — Observability

### Architecture decision: adopt SigNoz + OTEL (mirrors Real Trend)

**Decision: MADE.** AtlasMed will adopt the same observability stack as the reference project:

```
Application code
  ├── tracer.with()     → spans  → OTLP → collector → ClickHouse signoz_traces
  ├── logger.info()     → logs   → OTLP → collector → ClickHouse signoz_logs
  └── HTTP middleware   → spans  → OTLP → collector → signozspanmetrics → signoz_metrics

SigNoz UI reads ClickHouse → unified search, traces, logs, dashboards
```

**What this means for the existing code:**
- `apps/api/src/infrastructure/logging/logger.ts` (Pino) → **deleted**, replaced by `packages/observability`
- `packages/observability` (exists, currently unused) → **adopted** as the single shared logger/tracer
- QuestDB integration → **removed** (SigNoz replaces this)
- Prometheus metrics → **decision below** (keep for infra or consolidate to SigNoz)
- `console.*` everywhere → **replaced** with `logger.*` from `packages/observability`
- `AuditLog` in PostgreSQL → **stays** — it's a compliance record, not observability

### Note on AuditLog

`AuditLog` in `crm.audit_logs` is a **business/compliance record** answering "who did what, when" for LGPD and security audits. It is queried by admins, associated with User entities, and is part of the domain model.

Operational observability (what the system is doing at runtime) goes to SigNoz/ClickHouse via OTEL. These are parallel concerns, not competing ones.

---

### Step B1 — Fix `packages/observability`

The package has the right structure but has a stale reference (`'real-trend'` scope name) and needs minor cleanup.

- [ ] Search and replace `'real-trend'` scope reference in `packages/observability/src/otel.ts`
- [ ] Verify `initOpenTelemetry()`, `createLogger()`, `createTracer()` are all exported from `packages/observability/src/index.ts`
- [ ] Run existing observability unit tests — all must pass

### Step B2 — Wire `apps/api`

**Bootstrap (call before server starts):**

- [ ] Add `initOpenTelemetry()` call in `apps/api/src/app/server.ts` (before `app.listen()`):
  ```ts
  import { initOpenTelemetry } from '@atlasmed/observability'
  initOpenTelemetry({
    serviceName: environment.OTEL_SERVICE_NAME,
    endpoint: environment.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
    logsEndpoint: environment.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT,
  })
  ```
- [ ] Create `apps/api/src/infrastructure/logging/logger.ts` — exports `createLogger('api')` from `@atlasmed/observability`
- [ ] Create `apps/api/src/infrastructure/tracing/tracer.ts` — exports `createTracer('api')` from `@atlasmed/observability`
- [ ] Delete the Pino-based `logger.ts` once the new one is wired everywhere
- [ ] Remove QuestDB integration (`questdb.logger.ts`, QuestDB env vars) — SigNoz replaces it
- [ ] Update `apps/api/src/infrastructure/plugins/observability.plugin.ts` to use the shared logger for structured request logging (keep the Elysia OTEL plugin for auto HTTP spans)

**Replace `console.*` in runtime paths** (in priority order — request path first):

- [ ] `apps/api/src/app/app.ts` — global error handler
- [ ] `apps/api/src/app/server.ts` — startup messages
- [ ] `apps/api/src/app/config/environment.ts` — config error
- [ ] `apps/api/src/infrastructure/cache/redis.client.ts`
- [ ] `apps/api/src/infrastructure/audit/audit-log.service.ts`
- [ ] `apps/api/src/infrastructure/jobs/init.ts`
- [ ] `apps/api/src/infrastructure/jobs/cleanup.jobs.ts`
- [ ] `apps/api/src/infrastructure/jobs/notification.queue.ts`
- [ ] `apps/api/src/infrastructure/external-services/resend/resend-email.service.ts`
- [ ] `apps/api/src/infrastructure/external-services/resend/send-invite-email.ts`
- [ ] `apps/api/src/infrastructure/external-services/twilio/send-whatsapp.ts`
- [ ] `apps/api/src/infrastructure/external-services/twilio/twilio-messaging.service.ts`
- [ ] `apps/api/src/modules/access/infrastructure/email/send-email.ts`
- [ ] `apps/api/src/modules/access/infrastructure/cache/auth-cache.service.ts` (6 calls)
- [ ] `apps/api/src/modules/access/infrastructure/cache/session-cache.service.ts` (10 calls)
- [ ] `apps/api/src/modules/access/infrastructure/cache/scope-cache.service.ts` (4 calls)
- [ ] `apps/api/src/modules/access/infrastructure/cache/access-grant-cache.service.ts` (3 calls)
- [ ] `apps/api/src/modules/access/application/services/notification.service.ts`
- [ ] `apps/api/src/modules/access/application/services/rate-limiter.service.ts`

**Add business spans with `tracer.with()` on key operations:**

- [ ] Login use-case: `tracer.with('user.login', ..., { 'user.id': userId })`
- [ ] Session refresh: `tracer.with('session.refresh', ..., { 'user.id': userId, 'session.id': sessionId })`
- [ ] Invite flow: `tracer.with('user.invite', ..., { 'user.id': invitedByUserId })`
- [ ] Facility scope query: `tracer.with('scope.resolve.facilities', ..., { 'user.id': userId })`
- [ ] Registry ingestion run: `tracer.with('registry.ingestion.run', ..., { 'ingestion.run.id': runId })`

**AtlasMed-specific OTEL attribute naming:**

| Attribute | Used for |
|---|---|
| `user.id` | Actor on all authenticated operations |
| `session.id` | Session context |
| `facility.id` | Facility-scoped operations |
| `territory.id` | Territory-scoped operations |
| `ingestion.run.id` | Registry ingestion operations |
| `app.module` | `access` / `facility` / `territory` / `registry` |
| `request.id` | HTTP request correlation (x-request-id) |

### Step B3 — Wire `apps/workers`

- [ ] Add `initOpenTelemetry()` call in `apps/workers/cnes-ingestion/src/worker.ts`
  ```ts
  initOpenTelemetry({
    serviceName: 'atlasmed-cnes-worker',
    endpoint: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
    logsEndpoint: process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT,
  })
  ```
- [ ] Create a logger instance in the worker using `createLogger('cnes-worker')`
- [ ] Replace all `console.*` in `apps/workers/cnes-ingestion/src/` with `logger.*`
- [ ] Add `tracer.with()` around each Temporal activity for per-activity span visibility

### Step B4 — Config cleanup

- [ ] **Decision: keep TypeBox in API** (`environment.ts` is comprehensive and the server boots from it)
- [ ] Add OTEL env vars to the TypeBox schema in `apps/api/src/app/config/environment.ts` (already present, verify they're wired through)
- [ ] Deprecate `packages/config` — its Zod subset duplicates what TypeBox already validates. Mark it for removal in backlog.
- [ ] Implement `apps/web` env config:
  - [ ] `packages/config/src/env/web/web-env.ts` — add `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_MAPBOX_TOKEN`
  - [ ] Wire into `apps/web` at startup (or `next.config.ts`)

### Step B5 — Infrastructure: SigNoz Docker Compose

Create `deploy/observability.compose.yml` with the following services (mirroring Real Trend):

```yaml
services:
  zookeeper-1:
    image: signoz/zookeeper:3.7.1
    # ClickHouse coordination

  clickhouse:
    image: clickhouse/clickhouse-server:25.5.6
    # Telemetry storage — signoz_traces, signoz_logs, signoz_metrics, signoz_metadata
    volumes:
      - clickhouse_data:/var/lib/clickhouse

  signoz-telemetrystore-migrator:
    image: signoz/signoz-otel-collector:v0.144.2
    # One-shot: runs ClickHouse schema migrations then exits
    restart: on-failure

  signoz:
    image: signoz/signoz:latest
    # Web UI + query API
    # SQLite at /var/lib/signoz/signoz.db for dashboards/users/alerts (not telemetry)

  otel-collector-config:
    image: alpine:3.20
    # Config writer sidecar — writes collector YAML to shared volume

  otel-collector:
    image: signoz/signoz-otel-collector:v0.144.2
    # OTLP receiver: gRPC :4317, HTTP :4318
    # Pipelines:
    #   traces  → signozspanmetrics → clickhouse (traces + metrics + metadata)
    #   logs    → clickhouse logs
    #   metrics → clickhouse metrics
    #   host    → hostmetrics receiver → clickhouse metrics
```

- [ ] Create `deploy/observability.compose.yml` with all 6 services above
- [ ] Configure collector pipelines:
  - `otlp` receiver (`:4317` gRPC, `:4318` HTTP)
  - `hostmetrics` receiver with `/hostfs` for VPS host metrics
  - `signozspanmetrics/delta` processor for latency histograms from traces
  - `batch` processor
  - ClickHouse exporters for traces, logs, metrics, metadata
- [ ] Add `bun run observability:up` script to root `package.json`
- [ ] Document access URL in compose file (SigNoz UI on port 3301 or similar)

### Step B6 — Update env vars

Add to `apps/api/.env` and `.env.example`:

```bash
# Observability — OTEL (optional in local dev, required in production)
OTEL_SERVICE_NAME=atlasmed-api
# OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://otel-collector:4318/v1/traces
# OTEL_EXPORTER_OTLP_LOGS_ENDPOINT=http://otel-collector:4318/v1/logs
# OTEL_RESOURCE_ATTRIBUTES=deployment.environment=production
```

Add to workers env:
```bash
OTEL_SERVICE_NAME=atlasmed-cnes-worker
```

- [ ] Add env vars to `apps/api/.env.example`
- [ ] Add env vars to `apps/workers/cnes-ingestion` config
- [ ] Verify TypeBox schema in `environment.ts` accepts these vars without requiring them in dev

### Deployment environment matrix

| Setting | Local dev | Staging | Production |
|---|---|---|---|
| `OTEL_SERVICE_NAME` | `atlasmed-api` | `atlasmed-api` | `atlasmed-api` |
| Traces endpoint | `http://otel-collector:4318/v1/traces` | `http://otel-collector:4318/v1/traces` | `http://otel-collector:4318/v1/traces` |
| Logs endpoint | `http://otel-collector:4318/v1/logs` | `http://otel-collector:4318/v1/logs` | `http://otel-collector:4318/v1/logs` |
| `OTEL_RESOURCE_ATTRIBUTES` | `deployment.environment=development` | `deployment.environment=staging` | `deployment.environment=production` |
| Worker OTEL | Set (local SigNoz) | Set | Set |
| Database | `atlasmed` (local PG) | `atlasmed` (staging PG) | `atlasmed` (prod PG) |
| Redis | Local | Staging | Production |

---

## Part C — Environment Setup (dev / staging / production)

**Goal:** Every environment is self-contained, reproducible, and includes the full observability stack. Developers can run ClickHouse and SigNoz locally without any external dependencies.

### C1 — Environment file structure

Replace the current single `.env` approach with per-environment files:

```
apps/api/
├── .env.development    ← local dev (gitignored, sourced from .env.development.example)
├── .env.staging        ← staging values (gitignored, injected by CI)
├── .env.production     ← production values (gitignored, injected by CI)
├── .env.test           ← test DB + mocked externals (keep as-is)
├── .env.development.example  ← committed, safe template for onboarding
└── .env.example        ← remove (replaced by .env.development.example)

apps/workers/cnes-ingestion/
├── .env.development
├── .env.staging
├── .env.production
└── .env.development.example

apps/web/
├── .env.development.local
├── .env.staging.local
├── .env.production.local
└── .env.development.local.example
```

- [ ] Create `.env.development.example` for `apps/api` with all required vars and safe defaults
- [ ] Create `.env.development.example` for `apps/workers/cnes-ingestion`
- [ ] Create `.env.development.local.example` for `apps/web`
- [ ] Delete the current `apps/api/.env.example` (superseded)
- [ ] Document in root `README.md`: "copy `.env.*.example` → `.env.*` before running"

### C2 — Docker Compose structure

Separate compose files for different concerns, all in `deploy/`:

```
deploy/
├── docker-compose.base.yml          ← shared service definitions (postgres, redis)
├── docker-compose.dev.yml           ← local dev: postgres + redis + temporal + signoz stack
├── docker-compose.observability.yml ← SigNoz stack only (usable standalone)
├── docker-compose.temporal.yml      ← Temporal stack only (already exists)
└── docker-compose.staging.yml       ← staging overrides (image tags, resource limits)
```

**`docker-compose.dev.yml`** — one command to start everything for local dev:

Services included:
- PostgreSQL 16 with PostGIS (`crm`, `audit`, `registry` schemas auto-created)
- Redis
- Temporal server + Temporal UI
- ClickHouse + Zookeeper
- OTEL Collector (receives OTLP from API and workers)
- SigNoz UI

- [ ] Create `deploy/docker-compose.dev.yml` composing all of the above
- [ ] Create `deploy/docker-compose.observability.yml` (SigNoz stack in isolation — Step B5 above)
- [ ] Move/rename existing `docker-compose.temporal.yml` into `deploy/` if not already there
- [ ] Create `deploy/docker-compose.base.yml` with shared service definitions

### C3 — Root scripts

Update root `package.json` scripts so any developer can start any stack with one command:

```json
{
  "dev:up": "docker compose -f deploy/docker-compose.dev.yml up -d",
  "dev:down": "docker compose -f deploy/docker-compose.dev.yml down",
  "dev:logs": "docker compose -f deploy/docker-compose.dev.yml logs -f",
  "observability:up": "docker compose -f deploy/docker-compose.observability.yml up -d",
  "observability:down": "docker compose -f deploy/docker-compose.observability.yml down",
  "temporal:up": "docker compose -f deploy/docker-compose.temporal.yml up -d",
  "db:reset": "cd packages/database && bunx prisma migrate reset --force",
  "db:push": "cd packages/database && bunx prisma db push",
  "db:seed": "cd packages/database && bun run seed"
}
```

- [ ] Add all scripts above to root `package.json`
- [ ] Test `bun run dev:up` from a clean state — all services healthy

### C4 — Database per environment

Each environment gets its own isolated PostgreSQL database. The same three-schema layout (`crm`, `audit`, `registry`) is replicated in each.

| Environment | Database name | Host |
|---|---|---|
| Local dev | `atlasmed` | `localhost:5432` (Docker) |
| Test (CI) | `atlasmed_test` | `localhost:5432` (GitHub Actions service) |
| Staging | `atlasmed` | Staging PG host |
| Production | `atlasmed` | Prod PG host |

- [ ] Update `apps/api/.env.test` to point to `atlasmed_test` (separate from dev DB)
- [ ] Confirm CI GitHub Actions spins up its own `atlasmed_test` DB (already in `test.yml` — verify)
- [ ] Document staging and production DB provisioning requirements

### C5 — CI/CD pipeline additions

Currently CI only runs API tests. Extend to support the full three-environment promotion:

```
dev branch → PR → CI runs tests → merge to main
main → staging deploy (automated)
staging → production deploy (manual approval gate)
```

- [ ] Add staging deploy workflow (`.github/workflows/deploy-staging.yml`)
  - Triggers on push to `main`
  - Builds Docker images for `apps/api` and `apps/workers/cnes-ingestion`
  - Deploys to staging environment
  - Runs smoke tests against staging
- [ ] Add production deploy workflow (`.github/workflows/deploy-production.yml`)
  - Triggers on manual dispatch or git tag
  - Requires staging to be green
  - Manual approval gate before deploying
- [ ] Add web build + deploy to both workflows (`apps/web`)
- [ ] Ensure each environment has its own set of secrets in GitHub Actions

### C6 — SigNoz per environment

Each environment has its own SigNoz + ClickHouse instance. They share the same compose structure but different data volumes and access credentials.

| Environment | SigNoz | Notes |
|---|---|---|
| Local dev | `localhost:3301` (Docker) | Full stack, disposable |
| Staging | Deployed alongside app | Shared among team |
| Production | Deployed alongside app | Production SigNoz, restricted access |

- [ ] Local: SigNoz runs as part of `docker-compose.dev.yml` (Step C2)
- [ ] Staging/Prod: Add SigNoz stack to deployment compose files
- [ ] Set `OTEL_RESOURCE_ATTRIBUTES=deployment.environment=<env>` per environment so traces/logs are filterable by environment in SigNoz UI

### C7 — Onboarding verification

After all of the above is done, a new developer should be able to run:

```bash
git clone <repo>
cp apps/api/.env.development.example apps/api/.env.development
cp apps/web/.env.development.local.example apps/web/.env.development.local
bun install
bun run dev:up          # starts postgres + redis + temporal + signoz
bun run db:push         # applies schema
bun run db:seed         # seeds roles + admin user
bun run dev             # starts api + web + workers in watch mode
```

And have a fully working local environment with SigNoz at `localhost:3301` receiving traces and logs from the API.

- [ ] Write the onboarding steps above into `README.md` at the repo root
- [ ] Verify the full sequence works on a clean machine (no existing databases or containers)

---

## Done criteria

- All schema decisions made and documented
- All approved schema changes migrated and verified
- `packages/observability` cleaned up and tests passing
- `initOpenTelemetry()` called at startup in API and workers
- All runtime `console.*` replaced with `logger.*` from shared package
- Pino + QuestDB removed from API
- Business spans (`tracer.with()`) on key auth and ingestion operations
- `deploy/docker-compose.dev.yml` starts entire local stack with one command
- `deploy/docker-compose.observability.yml` starts SigNoz stack in isolation
- SigNoz receives traces and logs from local API and worker
- Per-environment `.env.*.example` files committed
- Staging deploy workflow created
- Production deploy workflow with manual gate created
- Onboarding sequence verified on clean machine
- Web env config implemented
