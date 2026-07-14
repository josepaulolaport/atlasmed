# Local Development Infrastructure

PostgreSQL + PostGIS runs **locally on your machine** — it is intentionally not included in Docker Compose.

## Quick start

```bash
# 1. Start supporting services (Redis, MinIO, Meilisearch)
bun run dev:up

# 2. Apply migrations and seed (requires local Postgres with PostGIS)
bun run db:migrate
bun run db:seed

# 3. (Optional) Start Temporal for CNES ingestion workflows
bun run temporal:up

# 4. (Optional) Start SigNoz observability stack
bun run observability:up

# 5. Start apps
bun run dev
```

## Service access

| Service | URL | Credentials |
|---|---|---|
| PostgreSQL (local) | `localhost:5432` | your local credentials |
| Redis | `localhost:6379` | — |
| MinIO Console | http://localhost:9001 | `minioadmin / minioadmin` |
| MinIO S3 API | http://localhost:9000 | — |
| Meilisearch | http://localhost:7700 | `masterKey` |
| Temporal UI | http://localhost:8088 | — |
| SigNoz UI | http://localhost:8080 | — (when observability stack is running) |
| OTEL Collector gRPC | `localhost:4317` | — |
| OTEL Collector HTTP | `localhost:4318` | — |

> **Note:** Temporal UI runs on port 8088; SigNoz UI runs on port 8080. They can run simultaneously.

## Files

| File | Purpose |
|---|---|
| `docker-compose.dev.yml` | Redis, MinIO, Meilisearch |
| `docker-compose.temporal.yml` | Temporal server + UI (uses its own Postgres on port 5433) |
| `scripts/signoz-up.sh` | Downloads and starts official SigNoz Docker stack |
| `scripts/signoz-down.sh` | Stops SigNoz stack |

## Environment files

Copy the `.env.development.example` files in each app:

- `apps/api/.env.development.example` → `apps/api/.env`
- `apps/workers/cnes-ingestion/.env.development.example` → `apps/workers/cnes-ingestion/.env`
- `apps/web/.env.development.local.example` → `apps/web/.env.local`

## PostgreSQL setup

Ensure your local database has PostGIS enabled:

```sql
CREATE DATABASE atlasmed;
\c atlasmed
CREATE EXTENSION IF NOT EXISTS postgis;
```

Then set `DATABASE_URL` in `apps/api/.env` to point at your local instance.
