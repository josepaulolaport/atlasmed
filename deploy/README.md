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

---

# Production Deploy (Uncloud)

Production backend services deploy to Uncloud with `deploy/uncloud.compose.yml`.

## Production services

| Service | Exposure | Purpose |
|---|---|---|
| `atlasmed-web` | `https://atlasmed-web.b1ixob.uncld.dev` | Admin/web app. |
| `atlasmed-api` | `https://atlasmed-api.b1ixob.uncld.dev` | Public HTTP API. |
| `atlasmed-api-worker` | private | BullMQ workers: notifications, cleanup, territory membership. |
| `atlasmed-cnes-worker` | private | Temporal worker for CNES ingestion workflows. |
| `atlasmed-temporal` | private | Temporal server. |
| `atlasmed-temporal-ui` | `https://atlasmed-temporal-ui.b1ixob.uncld.dev` | Temporal UI protected by the existing cluster Authelia guard. |
| `atlasmed-temporal-db` | private | Postgres only for Temporal metadata. The app Postgres remains remote. |
| `atlasmed-redis` | private | BullMQ, cache, and rate limiting. |
| `atlasmed-meilisearch` | private | Search index. |
| `atlasmed-minio` | private | S3-compatible storage for app files and CNES archives. |

All service names use the `atlasmed-` prefix to avoid collisions with other services already running in the cluster.
All production services are pinned to the Uncloud machine named `atlasmed` via `x-machines: atlasmed`.
The `Deploy Backend Infrastructure` workflow provisions the configured `STORAGE_BUCKET` and `CNES_ARCHIVE_S3_BUCKET` after MinIO deploys by running an ephemeral `minio/mc` container over SSH; bucket provisioning is not modeled as a long-lived Uncloud service.

## One-time setup

1. Create GitHub environment `production` secrets using `deploy/.env.production.example` as the checklist.
2. Ensure `DATABASE_URL` points at the remote Postgres application database. Do not deploy app Postgres in Uncloud.
3. Ensure the Uncloud cluster has a machine named `atlasmed`; the compose file pins every service to that machine.
4. Ensure the shared cluster Authelia config still exposes the Caddy snippet `internal_guard`; `atlasmed-temporal-ui` imports it.
5. Deploy infrastructure with the manual `Deploy Backend Infrastructure` GitHub Actions workflow. For local operator-only deploys, deploy the persistent services and then create the buckets from an ephemeral MinIO client container on the Uncloud host:
   ```bash
   uc deploy -f deploy/uncloud.compose.yml atlasmed-temporal-db atlasmed-temporal atlasmed-temporal-ui atlasmed-redis atlasmed-meilisearch atlasmed-minio --yes
   docker run --rm --network container:$(docker ps --filter 'ancestor=minio/minio:latest' --filter 'name=atlasmed-minio' --format '{{.ID}}' | head -n 1) -e MINIO_ROOT_USER -e MINIO_ROOT_PASSWORD -e STORAGE_BUCKET -e CNES_ARCHIVE_S3_BUCKET minio/mc:latest sh -c 'mc alias set local http://127.0.0.1:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" && mc mb --ignore-existing "local/${STORAGE_BUCKET:-atlasmed-production}" && mc mb --ignore-existing "local/${CNES_ARCHIVE_S3_BUCKET:-cnes-raw}"'
   ```
6. Deploy app services:
   ```bash
   uc deploy -f deploy/uncloud.compose.yml atlasmed-api atlasmed-api-worker atlasmed-cnes-worker atlasmed-web --yes
   ```

## Runtime health checks

- API: `https://atlasmed-api.b1ixob.uncld.dev/health`
- Web: `https://atlasmed-web.b1ixob.uncld.dev`
- Temporal UI: `https://atlasmed-temporal-ui.b1ixob.uncld.dev`

## Database migrations

Application migrations run against the remote `DATABASE_URL` from CI before deploying app containers:

```bash
cd packages/database && DATABASE_URL="$DATABASE_URL" bun run db:migrate
```

Temporal uses the `atlasmed-temporal-db` cluster Postgres volume and is managed by the Temporal auto-setup image.
