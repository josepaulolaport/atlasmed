# Phase 1 — Database Schema & Observability

**Goal:** Get the data model right and get real visibility into what the system is doing.  
**Rule:** Schema changes here. No new API routes or web pages. No feature work.  
**Status:** ✅ Complete — console logging always on; SigNoz/OTEL optional in dev

> **ClickHouse:** You never talk to ClickHouse directly. SigNoz (Phase 0.5 `bun run observability:up`) runs ClickHouse + OTEL Collector internally. Apps export OTLP → collector → ClickHouse (`signoz_traces`, `signoz_logs`, `signoz_metrics`). Query/visualize via SigNoz UI at `http://localhost:8080`.

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

#### 1. Healthcare sectors (not multi-tenant org) — DECIDED ✅

Single deployment. Vertical partition is **`sectors`** (catalog table), not `Organization`.

**Phase 1 (schema prep — done):**
- [x] Drop `territories.organization_id`
- [x] Add `territories.sector_id` → `sectors.id`
- [x] Add `user_sector_assignments` (manager/rep ↔ sector M2M)

**Phase 3/4 (application enforcement — planned):** see `phase-3-contracts.md` §6 and `phase-4-features.md` §4.8.

**Resolution model (intersection):**
```
effectiveTerritories(user) =
  assignedTerritories(user)
  ∩ { t | t.sector_id ∈ assignedSectors(user) }
```

- Each **territory** belongs to exactly one healthcare sector.
- Each **manager/rep** is assigned one or more sectors via `user_sector_assignments`.
- Territory assignments stay in `user_territory_assignments`; sector is not duplicated on that row.
- A user only sees territories whose sector they operate in.
- **ADMIN / OPS:** global (all sectors).
- **Validation:** assigning a territory to a user requires `territory.sector_id ∈ user.sector_ids`.

#### 2. Missing FK relations — DECIDED & IMPLEMENTED ✅

- [x] Added Drizzle FK relations on all listed user reference fields (`onDelete: set null` or `cascade` as appropriate)
- [x] Migration `0002_phase1_schema_decisions.sql`

#### 3. Visit domain — DECIDED ✅

- [x] **Remove** `VISIT` from `packages/access` (deferred domain — rebuild in Phase 4 §4.6 when product-ready)

#### 4. OPS role — DECIDED & IMPLEMENTED ✅

- [x] **Global read-only scope** (`createGlobalScopeContext` in `ScopeResolver`; CASL already denies writes)
- [x] OPS already in `ROLE_PRIORITY_BY_NAME` (priority 20)

#### 5. FacilityProfessional.relationshipLevel — DECIDED & IMPLEMENTED ✅

- [x] **Integer 1–10** on `facility_professionals` only (replaced `LOW/MEDIUM/HIGH` enum)
- [x] Removed unused `relationship_level` from `facility_representatives`
- [x] DB check constraint on `facility_professionals`: `>= 1 AND <= 10`

#### 6. cnes_diffs — DECIDED ✅

- [x] **Keep** warehouse records; read API in Phase 4 §4.7

#### 7. Registry warehouse tables — DECIDED ✅

- [x] **Keep warehouse-only**; expose via API only when a Phase 4 feature needs them

#### 8. Territory geo fields — DECIDED ✅

- [x] PostGIS columns already in Drizzle (`boundary`, `centroid`, `location`); geo **queries** deferred to backlog

---

### Legacy gaps (superseded — kept for history)

<details>
<summary>Original organization / FK / visit / OPS prompts (pre-decision)</summary>

#### 1. Organization / multi-tenancy

`Territory.organizationId` — **removed**. Use sectors instead.

#### 2. Missing FK relations

All listed fields now have proper FK relations.

#### 3. Visit domain

Removed from CASL; model deferred to Phase 4.

#### 4. OPS role

Implemented as global read-only.

</details>

---

### Migration checklist

- [x] Schema changes in migration `0002_phase1_schema_decisions.sql`
- [x] Migrations verified on fresh DB (`bun run db:migrate`)
- [x] Consumers typecheck after relationship level type change

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

- [x] Replace `'real-trend'` scope reference in `packages/observability/src/otel.ts`
- [x] Add `ConsoleLogger` + composite logger (console always; OTEL when configured)
- [x] Export `initOpenTelemetry()`, `createLogger()`, `createTracer()` from package index
- [x] Run observability unit tests

### Step B2 — Wire `apps/api`

**Bootstrap (call before server starts):**

- [x] `initOpenTelemetry()` in `bootstrap-telemetry.ts` (imported first in `server.ts`)
- [x] `apps/api/src/infrastructure/logging/logger.ts` — Pino-compatible wrapper over `@atlasmed/observability`
- [x] `apps/api/src/infrastructure/tracing/tracer.ts` — `createTracer('api')`
- [x] Removed Pino + QuestDB from API
- [x] `observability.plugin.ts` uses shared logger (QuestDB writes removed)
- [x] Runtime `console.*` replaced in request path, jobs, cache, email/twilio, audit

**Business spans (`tracer.with()`):**

- [x] Login use-case: `user.login`
- [x] Session refresh: `session.refresh`
- [x] Invite flow: `user.invite`
- [x] Scope resolve: `scope.resolve`
- [x] Registry ingestion run: `registry.ingestion.run`

**Dev ergonomics:**

- [x] Console logging always on (`ConsoleLogger` in every `createLogger()`)
- [x] OTEL export optional — no endpoints → no exporter, app still runs
- [x] Pretty console lines in development; JSON when `LOG_FORMAT=json` or production

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

- [x] `initOpenTelemetry()` in `bootstrap-telemetry.ts` (imported first in `worker.ts`)
- [x] Logger via `createLogger('cnes-worker')`
- [x] Worker startup/shutdown uses structured logger
- [x] `tracer.with()` around each Temporal activity (`instrumentation/wrap-activity.ts`)

### Step B4 — Config cleanup

- [x] OTEL env vars wired through TypeBox `environment.ts`
- [ ] Web env config (`NEXT_PUBLIC_API_URL`, etc.) — backlog
- [ ] Deprecate `packages/config` — backlog

### Step B5 — Infrastructure: SigNoz + ClickHouse

> **Done in Phase 0.5.** `bun run observability:up` downloads and starts the official SigNoz stack (ClickHouse + OTEL Collector + UI). No custom `observability.compose.yml` needed — SigNoz owns ClickHouse schema.

- [x] SigNoz stack via `deploy/scripts/signoz-up.sh`
- [x] `bun run observability:up` / `observability:down` in root `package.json`
- [ ] End-to-end verify: `bash deploy/scripts/verify-observability.sh` after `bun run observability:up`

### Step B6 — Update env vars

- [x] OTEL vars in `apps/api/.env.development.example`
- [x] Worker `.env.development.example` OTEL vars
- [x] TypeBox schema accepts OTEL vars (optional in dev)

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
