# Phase 0.5 — Infrastructure Readiness

**Goal:** One command starts the complete local environment. Every service the app needs — database, cache, object storage, search, observability, workflow engine — has a local equivalent. Environment files are clean and per-environment. No developer needs a cloud account to run this project.

**Rule:** No new features. No API routes. Schema changes to audit log column type only.  
**Status:** ✅ Complete

---

## Overview

Services this phase provisions:

| Service | Local replacement | Purpose |
|---|---|---|
| PostgreSQL + PostGIS | Docker `postgis/postgis:16-3.4` | Business data, audit trail |
| Redis | Docker `redis:7-alpine` | Sessions, caches, BullMQ jobs |
| ClickHouse | Docker `clickhouse/clickhouse-server:25.5.6` | Telemetry storage (SigNoz backend) |
| OTEL Collector | Docker `signoz/signoz-otel-collector` | Receives traces + logs from API and workers |
| SigNoz | Docker `signoz/signoz:latest` | Observability UI: traces, logs, metrics |
| MinIO | Docker `minio/minio:latest` | Local S3-compatible object storage |
| Meilisearch | Docker `getmeili/meilisearch:v1` | Full-text search (facilities, professionals) |
| Temporal | Docker (existing compose) | Workflow engine for CNES ingestion |

---

## Step 1 — Audit log column migration

The `event_type` column in `audit.audit_logs` is a Postgres enum. Every new auditable action requires a DB migration. Change it to `text`.

- [ ] In `packages/database/src/schema/audit/index.ts`:
  - Remove `auditEventTypeEnum` from the table definition
  - Change `event_type` to `text("event_type").notNull()`
  - Drop the `auditEventTypeEnum` pgEnum definition entirely
  - Keep `auditEventSeverityEnum` — it's a stable 4-value set
- [ ] In `packages/database/src/index.ts`: remove `AuditEventType` export (it was derived from the enum)
- [ ] Add an application-level Zod validator in `apps/api/src/infrastructure/audit/` that validates `event_type` follows the `DOMAIN.ACTION` convention
- [ ] Generate a Drizzle migration: `bunx drizzle-kit generate`
- [ ] Apply migration: `bun run db:migrate` (in `packages/database`)

**Convention for event types** — format is always `DOMAIN.ACTION`:

| Domain | Example actions |
|---|---|
| `USER` | `LOGIN`, `LOGOUT`, `INVITE`, `ACCEPT_INVITE`, `DEACTIVATE`, `ACTIVATE`, `SUSPEND`, `PASSWORD_RESET` |
| `FACILITY` | `CREATED`, `UPDATED`, `DEACTIVATED`, `TERRITORY_ASSIGNED` |
| `PROFESSIONAL` | `CREATED`, `UPDATED`, `LINKED`, `UNLINKED` |
| `TERRITORY` | `CREATED`, `UPDATED`, `REPARENTED`, `BOUNDARY_SET`, `APPROVAL_REQUESTED`, `APPROVED`, `REJECTED` |
| `REGISTRY` | `INGESTION_STARTED`, `INGESTION_COMPLETED`, `SUGGESTION_APPROVED`, `SUGGESTION_REJECTED` |
| `CATALOG` | `PRODUCT_CREATED`, `PRODUCT_UPDATED` |
| `SYSTEM` | `CLEANUP_JOBS_RAN`, `SESSION_EXPIRED` |

---

## Step 2 — Replace typed audit functions with single middleware

The current `IAuditLog` interface has ~20 typed functions (`logInviteUser`, `logRevokeInvite`, etc.). Every new endpoint or action requires a new function. Replace this with a single `onAfterHandle` Elysia hook.

- [ ] Create `apps/api/src/infrastructure/audit/audit.middleware.ts`:
  - Export an Elysia plugin that registers `onAfterHandle`
  - Infers `event_type` from HTTP method + route path
  - Reads actor from request store (set by auth plugin)
  - Extracts `targetId` from route params
  - Writes to `audit.audit_logs` as fire-and-forget (never blocks response)
  - Only runs on authenticated requests (skip if no actor in store)
- [ ] Create `apps/api/src/infrastructure/audit/event-type-map.ts`:
  - Maps `{METHOD} {path pattern}` → `DOMAIN.ACTION`
  - Covers all existing routes
  - Falls back to `UNKNOWN.{METHOD}` for unmapped routes (logged as WARN severity)
- [ ] Wire the audit middleware into `apps/api/src/app/app.ts` (global, after auth plugin)
- [ ] Keep the existing `IAuditLog` interface and typed functions in place for this phase — mark them as `@deprecated` and remove in Phase 2
- [ ] New routes added after this phase do not call any `auditLog.*` function — the middleware handles it

---

## Step 3 — Object storage (MinIO)

MinIO is the local equivalent of AWS S3 / Cloudflare R2. Needed for: facility document uploads, profile photos, CNES import file staging.

- [ ] Add MinIO service to `deploy/docker-compose.dev.yml` (see Step 5)
- [ ] Create `packages/storage` (or `apps/api/src/infrastructure/storage/`):
  - [ ] `storage.client.ts` — initializes `@aws-sdk/client-s3` pointing to MinIO in dev, S3/R2 in prod
  - [ ] `storage.service.ts` — wraps client: `upload(key, buffer)`, `download(key)`, `signedUrl(key, ttl)`
  - [ ] No business logic — thin adapter only
- [ ] Add env vars to `.env.development.example`:
  ```bash
  STORAGE_ENDPOINT=http://localhost:9000        # MinIO in dev; empty = S3 in prod
  STORAGE_ACCESS_KEY_ID=minioadmin
  STORAGE_SECRET_ACCESS_KEY=minioadmin
  STORAGE_BUCKET=atlasmed-dev
  STORAGE_REGION=us-east-1
  ```
- [ ] Add MinIO vars to TypeBox schema in `apps/api/src/app/config/environment.ts` (all optional — storage features degrade gracefully when not configured)

---

## Step 4 — Search (Meilisearch)

Meilisearch is the search engine. Needed for: facility and professional full-text search (replaces the current `ilike` queries that don't scale).

- [ ] Add Meilisearch service to `deploy/docker-compose.dev.yml` (see Step 5)
- [ ] Create `apps/api/src/infrastructure/search/`:
  - [ ] `search.client.ts` — initializes `meilisearch` npm client
  - [ ] `search.service.ts` — wraps client: `index(name).search(query)`, `index(name).addDocuments(docs)`, `index(name).updateDocuments(docs)`, `index(name).deleteDocument(id)`
  - [ ] No business logic — thin adapter only
- [ ] Add env vars to `.env.development.example`:
  ```bash
  MEILISEARCH_URL=http://localhost:7700
  MEILISEARCH_API_KEY=masterKey
  ```
- [ ] Add Meilisearch vars to TypeBox schema (optional — features degrade gracefully)
- [ ] **No indexing logic yet** — indexing and search routes go in Phase 4. This step is infrastructure and adapter only.

---

## Step 5 — Docker Compose dev stack

A single `docker-compose.dev.yml` that starts every service the app needs for local development.

- [ ] Create `deploy/docker-compose.dev.yml`:

```yaml
# deploy/docker-compose.dev.yml
# Usage: bun run dev:up

services:
  postgres:
    image: postgis/postgis:16-3.4
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: atlasmed
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000"   # S3 API
      - "9001:9001"   # MinIO Console UI
    volumes:
      - minio_data:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s

  meilisearch:
    image: getmeili/meilisearch:v1.11
    environment:
      MEILI_MASTER_KEY: masterKey
      MEILI_ENV: development
    ports:
      - "7700:7700"
    volumes:
      - meilisearch_data:/meili_data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:7700/health"]
      interval: 10s

  clickhouse:
    image: clickhouse/clickhouse-server:25.5.6
    user: "101:101"
    environment:
      CLICKHOUSE_DB: default
    ports:
      - "9009:9009"
      - "8123:8123"
    volumes:
      - clickhouse_data:/var/lib/clickhouse
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:8123/ping"]
      interval: 10s

  zookeeper:
    image: signoz/zookeeper:3.7.1
    environment:
      ZOO_MY_ID: 1
      ZOO_SERVERS: server.1=zookeeper:2888:3888
    volumes:
      - zookeeper_data:/data
      - zookeeper_logs:/datalog

  otel-collector:
    image: signoz/signoz-otel-collector:v0.144.2
    command: ["--config=/etc/otel-collector-config.yaml"]
    volumes:
      - ./otel-collector-config.yaml:/etc/otel-collector-config.yaml:ro
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
    ports:
      - "4317:4317"    # OTLP gRPC
      - "4318:4318"    # OTLP HTTP
    depends_on:
      - clickhouse

  signoz:
    image: signoz/signoz:latest
    ports:
      - "3301:3301"    # SigNoz UI → http://localhost:3301
    environment:
      STORAGE: clickhouse
      CLICKHOUSE_URL: tcp://clickhouse:9000
    volumes:
      - signoz_data:/var/lib/signoz
    depends_on:
      - clickhouse
      - otel-collector

volumes:
  postgres_data:
  redis_data:
  minio_data:
  meilisearch_data:
  clickhouse_data:
  zookeeper_data:
  zookeeper_logs:
  signoz_data:
```

- [ ] Create `deploy/otel-collector-config.yaml` with:
  - OTLP receiver (`:4317` gRPC, `:4318` HTTP)
  - ClickHouse exporter for traces, logs, metrics
  - `signozspanmetrics` processor for latency histograms from traces
  - `batch` processor
- [ ] Move/confirm existing Temporal compose into `deploy/docker-compose.temporal.yml`

---

## Step 6 — Environment files

- [ ] Create `apps/api/.env.development.example` — safe defaults for local dev:
  ```bash
  # Database
  DATABASE_URL=postgresql://postgres:postgres@localhost:5432/atlasmed

  # Redis
  REDIS_URL=redis://localhost:6379

  # Auth
  JWT_SECRET=dev-secret-change-in-production
  JWT_REFRESH_SECRET=dev-refresh-secret-change-in-production
  JWT_ACCESS_EXPIRATION=15m
  JWT_REFRESH_EXPIRATION=30d
  SESSION_SECRET=dev-session-secret
  TWO_FACTOR_ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000

  # Object storage (MinIO local)
  STORAGE_ENDPOINT=http://localhost:9000
  STORAGE_ACCESS_KEY_ID=minioadmin
  STORAGE_SECRET_ACCESS_KEY=minioadmin
  STORAGE_BUCKET=atlasmed-dev
  STORAGE_REGION=us-east-1

  # Search (Meilisearch local)
  MEILISEARCH_URL=http://localhost:7700
  MEILISEARCH_API_KEY=masterKey

  # Observability (optional in dev)
  OTEL_SERVICE_NAME=atlasmed-api
  # OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4318/v1/traces
  # OTEL_EXPORTER_OTLP_LOGS_ENDPOINT=http://localhost:4318/v1/logs
  OTEL_RESOURCE_ATTRIBUTES=deployment.environment=development

  # External services (leave empty to disable in dev)
  # RESEND_API_KEY=
  # RESEND_FROM_EMAIL=
  # TWILIO_ACCOUNT_SID=
  # TWILIO_AUTH_TOKEN=
  # TWILIO_WHATSAPP_FROM=
  # MAPBOX_TOKEN=
  ```

- [ ] Create `apps/workers/cnes-ingestion/.env.development.example`
- [ ] Create `apps/web/.env.development.local.example`
- [ ] Update root `README.md` onboarding section

---

## Step 7 — Root scripts

- [ ] Add to root `package.json`:
  ```json
  {
    "dev:up":              "docker compose -f deploy/docker-compose.dev.yml up -d",
    "dev:down":            "docker compose -f deploy/docker-compose.dev.yml down",
    "dev:down:volumes":    "docker compose -f deploy/docker-compose.dev.yml down -v",
    "dev:logs":            "docker compose -f deploy/docker-compose.dev.yml logs -f",
    "dev:ps":              "docker compose -f deploy/docker-compose.dev.yml ps",
    "temporal:up":         "docker compose -f deploy/docker-compose.temporal.yml up -d",
    "temporal:down":       "docker compose -f deploy/docker-compose.temporal.yml down",
    "observability:up":    "docker compose -f deploy/docker-compose.dev.yml up -d clickhouse zookeeper otel-collector signoz",
    "db:migrate":          "cd packages/database && bun run db:migrate",
    "db:seed":             "cd apps/api && bun run db:seed"
  }
  ```

---

## Step 8 — CI verification

Update `test.yml` to confirm the new postgres image (PostGIS) and redis are both healthy before tests run. Already done in Phase 0 — verify here:

- [ ] Confirm `test.yml` uses `postgis/postgis:16-3.4` image (not plain `postgres:16`)
- [ ] Confirm Redis service is defined with health check
- [ ] Add MinIO service to CI if any tests use storage (likely none yet — skip)

---

## Service access cheatsheet

After `bun run dev:up`:

| Service | URL | Credentials |
|---|---|---|
| PostgreSQL | `localhost:5432` | `postgres / postgres` |
| Redis | `localhost:6379` | — |
| MinIO Console | http://localhost:9001 | `minioadmin / minioadmin` |
| MinIO S3 API | http://localhost:9000 | — |
| Meilisearch | http://localhost:7700 | `masterKey` |
| SigNoz UI | http://localhost:3301 | — |
| OTEL Collector gRPC | `localhost:4317` | — |
| OTEL Collector HTTP | `localhost:4318` | — |
| Temporal UI | http://localhost:8080 | — |

---

## Done criteria

- [ ] `bun run dev:up` starts all services; all health checks pass within 60s
- [ ] `bun run db:migrate && bun run db:seed` runs cleanly against the local postgres
- [ ] `apps/api` and `apps/workers` can be started with OTEL env vars pointing at the local collector; SigNoz at `localhost:3301` receives spans
- [ ] MinIO is accessible at `localhost:9000`; bucket `atlasmed-dev` created
- [ ] Meilisearch is accessible at `localhost:7700`
- [ ] `apps/api/.env.development.example` and both worker/web equivalents are committed
- [ ] Root scripts `dev:up`, `dev:down`, `db:migrate`, `db:seed` all work
- [ ] `audit.audit_logs.event_type` is a `text` column (not enum)
- [ ] Audit middleware captures all authenticated requests; no typed function needed for new routes
