# Spec 39 — CNES Temporal Ingestion Pipeline

**Domain:** Registry warehouse load · Temporal orchestration · CRM reconciliation · Suggestions  
**Status:** Spec reviewed (Step 0 complete)  
**Last Updated:** 2026-07-07  
**Depends on:** [Spec 38 — Registry Ingestion](./38-registry-ingestion.md)

---

## Overview

Monthly CNES ingestion pipeline that:

1. Discovers and downloads the latest monthly `BASE_DE_DADOS_CNES_YYYYMM.ZIP` from DATASUS CNES FTP (`/cnes`)
2. Archives the ZIP (MinIO local dev / S3 prod), extracts CSVs, preflights expected files
3. Bulk-loads all **25 registry tables** into `registry_staging` (hybrid v1: Python `import_modular.py`; see Technical debt)
4. Validates staging, reconciles against CRM truth, and generates **suggestions**
5. Auto-promotes staging → `registry` (current), rolling previous month to `registry_previous`
6. Syncs lightweight source metadata on CRM shells (no silent field overwrites)
7. Deletes previous month's raw archive after a successful run

Orchestration: **Temporal** (local via `docker-compose.temporal.yml`; prod TBD).  
Heavy I/O: **`apps/workers/cnes-ingestion`**.  
Shared parsers/FTP: **`packages/cnes-ingestion`**.  
Trigger + suggestion APIs: **`apps/api`** (existing registry-ingestion module extended).

---

## Decisions (locked)

| Topic | Decision |
|-------|----------|
| Registry tables loaded | All 25 CNES tables every run |
| Suggestion scope | Public truth entities only: facilities, professionals, associations, representatives |
| Field mismatches | `FACILITY_FIELD_UPDATE`, `PROFESSIONAL_FIELD_UPDATE`, `FACILITY_REPRESENTATIVE_FIELD_UPDATE` for `SOURCE_TRACKED` fields |
| New CRM entities | Auto-create source-tracked shells (no `ENTITY_CREATE` suggestion) |
| New associations | `FACILITY_PROFESSIONAL_ADD` when link is new and **at least one side already existed in CRM before the run**; auto-create link silently when both sides are new in the same run |
| Deactivation | Suggest after **1** missing month |
| Warehouse promotion | **Auto** after validation passes |
| Reconcile timing | Against `registry_staging` **before** promote |
| Raw archive | `ArchiveStoragePort` — MinIO in `docker-compose.temporal.yml` (dev), AWS S3 later |
| FTP v1 | Real DATASUS anonymous FTP at `/cnes`; always ingest latest `BASE_DE_DADOS_CNES_YYYYMM.ZIP` |
| Staging load v1 | **Hybrid:** Python `import_modular.py` subprocess → `registry_staging` (`CNES_LOAD_MODE=ftp`) |
| Staging load dev | `CNES_LOAD_MODE=dev` copies `mcp_test` → `registry_staging` (CI / local without Python) |
| Extract volume | Size worker/extract dir for ZIP + extracted CSVs (~8–10 GB headroom) |
| Temporal v1 | `docker-compose.temporal.yml` for local dev |
| Monorepo layout | `apps/workers/cnes-ingestion` (worker), `packages/cnes-ingestion` (I/O lib) |

---

## Architecture

```text
CNES FTP (/cnes/BASE_DE_DADOS_CNES_YYYYMM.ZIP)
  → ArchiveStoragePort (MinIO dev / S3 prod, checksum manifest)
  → Extract to CNES_EXTRACT_DIR (system unzip)
  → Preflight expected CSV files (26 CNES → 25 warehouse tables)
  → Load registry_staging (Python import_modular v1 OR mcp_test copy in dev)
  → Validate staging
  → Reconcile staging vs public → ingestion_diffs + ingestion_suggestions
  → Auto-promote: staging → registry, registry → registry_previous
  → Sync CRM metadata (source_last_seen_at, content_hash, mark absences)
  → IngestionRun complete
  → Delete previous month raw archive
```

### Layer responsibilities

| Layer | Schema / component | Role |
|-------|-------------------|------|
| Raw archive | Object storage / local volume | Immutable FTP artifacts per `ano/mes` |
| Staging | `registry_staging` | In-progress monthly load |
| Current warehouse | `registry` | Published CNES mirror (read APIs) |
| Previous warehouse | `registry_previous` | One prior month (MoM diff, audit) |
| CRM truth | `public` | Operational data; field ownership enforced |
| Suggestions | `public.ingestion_suggestions` | Human-reviewed proposed changes |
| Runs | `public.ingestion_runs` | Pipeline execution record + stats |

### Monorepo layout

```text
apps/
  api/                          # POST /registry-ingestion/run, status, suggestions (existing module)
  workers/
    cnes-ingestion/             # @atlasmed/cnes-ingestion-worker — Temporal worker + activities
packages/
  cnes-ingestion/               # @atlasmed/cnes-ingestion — FTP, parsers, normalizers, validators
  database/                     # Prisma + migrations (registry_staging, registry_previous, ingestion_runs)
docker-compose.temporal.yml     # Temporal server + UI (:8080) + MinIO (:9000/:9001)
```

**Workspace globs** (root `package.json`):

```json
"workspaces": [
  "apps/*",
  "apps/workers/*",
  "packages/*"
]
```

---

## Temporal design

### Workflow ID

`cnes-ingestion-{ano}-{mes}` — idempotent; duplicate start returns existing run.

### Parent workflow: `cnesMonthlyIngestionWorkflow`

| Step | Activity | Notes |
|------|----------|-------|
| 1 | `discoverLatestReference` | FTP listing → `{ ano, mes }` |
| 2 | `downloadRawFiles` | Per-file download → archive; resumable via manifest |
| 3 | `parseAndNormalize` | Child workflow or parallel activities per source file |
| 4 | `loadRegistryStaging` | Parallel per table (concurrency cap e.g. 4) |
| 5 | `validateStaging` | Hard gate; fail workflow on logical errors |
| 6 | `reconcileCrmDiff` | SQL set-based; write `ingestion_diffs` + `ingestion_suggestions` |
| 7 | `reconcileWarehouseDiff` | Optional MoM: staging vs `registry`; stats only in v1 |
| 8 | `promoteRegistrySwap` | Atomic schema rename |
| 9 | `syncCrmMetadata` | Batch update shells; no CRM field overwrites |
| 10 | `finalizeIngestionRun` | Set `IngestionRun.status = COMPLETED`, persist stats (`phase` is not used for terminal state) |

**Retry policy:** exponential backoff on I/O activities; no retry on validation failure.

**Timeouts:** download/parse/load activities — 30–120 min; validate — 10 min; reconcile — 120 min; swap — 5 min.

### API integration

- `POST /registry-ingestion/run` → Temporal client `startWorkflow` (replaces Redis lock path for production runs)
- `GET /registry-ingestion/runs/:id` → merge `IngestionRun` + Temporal workflow status query
- Mock/demo fixture path remains for integration tests (unchanged)

---

## Database changes

### New schemas

| Schema | Purpose |
|--------|---------|
| `registry_staging` | Same 25-table shape as `registry`; truncated/reloaded each run |
| `registry_previous` | Prior month after successful swap |

**Promotion (transaction):**

```sql
-- Conceptual; exact migration uses ALTER SCHEMA RENAME
DROP SCHEMA IF EXISTS registry_previous CASCADE;
ALTER SCHEMA registry RENAME TO registry_previous;
ALTER SCHEMA registry_staging RENAME TO registry;
CREATE SCHEMA registry_staging;
-- Recreate empty staging tables from template / migration
```

### Staging / previous and Prisma

- **Do not** triple auto-generated Prisma models for `registry_staging` and `registry_previous`.
- Keep generated models in [`registry.prisma`](../../../packages/database/prisma/registry.prisma) scoped to `@@schema("registry")` only.
- Worker activities access staging/previous via raw SQL (`$executeRaw` / `COPY`) with qualified schema names or `search_path`.
- Clone DDL in migrations; provide a SQL template to recreate empty `registry_staging` after each promote swap.

### Extend `IngestionRun`

| Field | Type | Purpose |
|-------|------|---------|
| `temporalWorkflowId` | `String?` | `cnes-ingestion-{ano}-{mes}` |
| `referenceAno` | `Int?` | CNES reference year |
| `referenceMes` | `Int?` | CNES reference month |
| `phase` | `IngestionRunPhase?` | In-flight pipeline step only; cleared or left at last step when terminal |
| `phaseStartedAt` | `DateTime?` | Last phase transition |
| `validationReport` | `Json?` | Validation activity output |
| `promotedAt` | `DateTime?` | Swap timestamp |
| `archiveManifest` | `Json?` | Raw file paths + checksums |

```prisma
enum IngestionRunPhase {
  DISCOVERING
  DOWNLOADING
  PARSING
  LOADING
  VALIDATING
  RECONCILING
  PROMOTING
  SYNCING
  FAILED
}
```

`IngestionRunPhase` tracks **in-flight** steps only. Terminal outcomes use existing `IngestionRunStatus` (`COMPLETED`, `FAILED`). Do not add `COMPLETED` to `IngestionRunPhase`.

### New table: `ingestion_diffs` (optional v1, recommended)

Materialized diff rows before suggestion dedup.

| Column | Purpose |
|--------|---------|
| `ingestionRunId` | FK |
| `scope` | `WAREHOUSE` \| `CRM` |
| `entityType` | facility, professional, association, representative |
| `externalSourceId` | CNES natural key |
| `diffType` | NEW, CHANGED, MISSING, LINK_NEW, … |
| `payload` | JSON before/after or hash delta |

### Content hash

- Registry warehouse tables do **not** store `content_hash` columns (v1).
- At reconcile, **compute** a canonical content hash from projected staging fields (via `registry-projection.service` patterns).
- Compare computed hash to CRM `sourceContentHash` on source-tracked `Facility` / `Professional` records.
- On metadata sync after promote, persist updated `sourceContentHash` and `sourceLastSeenAt` — never overwrite `CRM_OWNED` fields.
- Hash equality skips `*_FIELD_UPDATE` suggestions for unchanged entities.

---

## Suggestion rules (v1)

### Auto-actions (no suggestion)

| Event | Action |
|-------|--------|
| New facility in registry, not in CRM | Create source-tracked `Facility` shell |
| New professional in registry, not in CRM | Create source-tracked `Professional` shell |
| New representative in registry | Create shell if applicable |
| New facility–professional link; **both** ends new in same run | Auto-create association (no suggestion) |
| Entity unchanged (computed `content_hash` match) | Skip field-update suggestions |

### Suggestions created

| Type | Trigger |
|------|---------|
| `FACILITY_FIELD_UPDATE` | Facility exists; `SOURCE_TRACKED` field differs |
| `PROFESSIONAL_FIELD_UPDATE` | Professional exists; `SOURCE_TRACKED` field differs (new enum value) |
| `FACILITY_REGISTRY_DEACTIVATED` | CRM facility missing from staging (1 month) |
| `FACILITY_REGISTRY_REACTIVATED` | Deleted CRM facility reappears in staging |
| `FACILITY_PROFESSIONAL_ADD` | New link in staging; **at least one** of facility or professional already existed in CRM before this run |
| `FACILITY_PROFESSIONAL_REMOVAL` | Association in CRM missing from staging |
| `FACILITY_REPRESENTATIVE_ADD` | New representative link requiring review (same one-side-pre-existing rule) |
| `FACILITY_REPRESENTATIVE_FIELD_UPDATE` | Representative exists; `SOURCE_TRACKED` field differs |
| `FACILITY_REPRESENTATIVE_REMOVAL` | Representative link missing from staging |

### Field ownership

| Ownership | On ingest |
|-----------|-----------|
| `SOURCE_TRACKED` | Diff → suggest on mismatch |
| `CRM_OWNED` | Never suggest overwrite |
| `DERIVED` | Not from CNES; geocode/territory jobs run after approved address change |

CNES `reference_municipality_code` → address metadata only, **not** territory FK.

### Dedup / supersede

- One pending suggestion per `(entity, type)`; newer run supersedes older pending
- Computed hash equality → no `*_FIELD_UPDATE`
- Group multiple field changes into one suggestion payload per entity

---

## Package: `packages/cnes-ingestion`

Domain-agnostic I/O only. **No** suggestion logic, **no** Prisma CRM access.

### Exports

| Module | Responsibility |
|--------|----------------|
| `ftp/cnes-ftp.client.ts` | `CnesFtpPort` — list, download (mock + real impl) |
| `archive/archive-storage.port.ts` | `ArchiveStoragePort` — put/get/list by `ano/mes` |
| `archive/local-archive.adapter.ts` | Local volume / MinIO for dev |
| `archive/s3-archive.adapter.ts` | Stub for prod (wire later) |
| `parse/` | Per-table CNES file parsers (stream-based) |
| `normalize/` | Canonical column shapes, encoding, dates |
| `validate/` | Row-level validators (reused by worker validate activity) |
| `manifest.ts` | Download manifest types |

### Ports (for worker injection)

```typescript
interface CnesFtpPort {
  discoverLatest(): Promise<{ ano: number; mes: number }>;
  listFiles(ano: number, mes: number): Promise<FtpFileEntry[]>;
  downloadFile(entry: FtpFileEntry, dest: Writable): Promise<void>;
}

interface ArchiveStoragePort {
  put(manifest: ArchiveManifest): Promise<void>;
  getManifest(ano: number, mes: number): Promise<ArchiveManifest | null>;
  openReadStream(key: string): Promise<Readable>;
}
```

---

## Worker: `apps/workers/cnes-ingestion`

### Dependencies

- `@temporalio/worker`, `@temporalio/workflow`, `@temporalio/activity`
- `@atlasmed/cnes-ingestion`
- `@atlasmed/database`

### Structure

```text
apps/workers/cnes-ingestion/
  src/
    workflows/
      cnes-monthly-ingestion.workflow.ts
    activities/
      discover.activity.ts
      download.activity.ts
      parse.activity.ts
      load-staging.activity.ts
      validate-staging.activity.ts
      reconcile-crm.activity.ts
      reconcile-warehouse.activity.ts
      promote-swap.activity.ts
      sync-crm-metadata.activity.ts
      finalize-run.activity.ts
    worker.ts
    config.ts
  package.json
  tsconfig.json
```

### Activity implementation notes

- **loadRegistryStaging:** `COPY` or batched `INSERT` per table; drop/recreate non-PK indexes around load
- **reconcileCrmDiff:** raw SQL or Prisma `$queryRaw`; batch suggestion inserts
- **syncCrmMetadata:** mirror patterns from `import-mcp-test-data.ts` `--sync-public` but metadata-only (no field overwrite)

---

## API changes (`apps/api`)

| Change | Detail |
|--------|--------|
| Temporal client | New infra module; env: `TEMPORAL_ADDRESS`, `TEMPORAL_NAMESPACE`, `TEMPORAL_TASK_QUEUE` |
| `RunRegistryIngestionUseCase` | Production path starts Temporal workflow; demo/mock path unchanged |
| `ListIngestionRunsUseCase` | Expose `phase`, `referenceAno`, `referenceMes` |
| `suggestion.use-cases.ts` | Approve handlers for `FACILITY_PROFESSIONAL_ADD`, `PROFESSIONAL_FIELD_UPDATE`, `FACILITY_REPRESENTATIVE_*` |
| New query | Optional: `GET /registry-ingestion/runs/:id/status` → Temporal describe |

---

## Validation gates (activity 5)

| Check | Failure mode |
|-------|--------------|
| All expected tables non-empty (or above min row threshold) | FAIL |
| Facility count within ±X% of current `registry` (configurable, default 15%) | FAIL — **skipped when `registry` is empty** (bootstrap / first run) |
| FK integrity within staging | FAIL |
| Consistent `ano/mes` metadata across loaded tables | FAIL |
| No duplicate natural keys per table | FAIL |

Output: `validationReport` JSON on `IngestionRun`.

---

## Observability

| Signal | Where |
|--------|-------|
| Phase transitions | `IngestionRun.phase` + structured logs |
| Per-table load stats | `IngestionRun.stats` JSON |
| Temporal UI | Local `:8080` |
| Alerts (later) | Validation fail, workflow timeout, row count anomaly |

---

## Implementation phases

### Phase 0 — Spec & plan (complete)

Spec reviewed; 8 corrections applied (enum names, association rule, hash strategy, Prisma staging approach, first-run validation, phase vs status).

### Phase 1 — Scaffold (no FTP)

- [ ] Branch `feature/cnes-temporal-ingestion`
- [ ] `docker-compose.temporal.yml`
- [ ] `packages/cnes-ingestion` skeleton + ports + mock FTP + local archive
- [ ] `apps/workers/cnes-ingestion` hello-world workflow + worker boot
- [ ] Root workspace + Turbo pipeline for worker
- [ ] API: Temporal client + start workflow stub

### Phase 2 — Schemas

- [ ] Migration: `registry_staging`, `registry_previous` (clone `registry` DDL)
- [ ] Migration: extend `IngestionRun` + `IngestionRunPhase`
- [ ] Migration: `ingestion_diffs` (recommended)
- [ ] Migration: add `PROFESSIONAL_FIELD_UPDATE` to `IngestionSuggestionType`
- [ ] Staging DDL recreate script for post-swap empty `registry_staging`

### Phase 3 — Load path (dev without FTP)

- [ ] Activity: load staging from `mcp_test` or SQL dump (dev adapter implementing same port as FTP path)
- [ ] Activity: validate staging
- [ ] Activity: promote swap (test with small dataset)

### Phase 4 — Reconcile & suggestions

- [ ] Refactor diff/sync to read from `registry_staging` in batches
- [ ] SQL reconcile: facilities, professionals, associations, representatives
- [ ] Suggestion dedup/supersede at scale
- [ ] Activity: sync CRM metadata post-promote

### Phase 5 — FTP & archive

- [ ] Research CNES FTP layout; implement `CnesFtpPort` real adapter
- [ ] Wire `ArchiveStoragePort` to MinIO in docker-compose
- [ ] Parse activities per CNES file format
- [ ] End-to-end workflow with real download

### Phase 6 — Hardening

- [ ] Integration tests (mock FTP → staging → suggestions)
- [ ] Run dashboard fields in API
- [ ] S3 archive adapter
- [ ] Prod Temporal deployment notes

---

## Environment variables

| Variable | Used by | Example |
|----------|---------|---------|
| `TEMPORAL_ADDRESS` | api, worker | `localhost:7233` |
| `TEMPORAL_NAMESPACE` | api, worker | `default` |
| `TEMPORAL_TASK_QUEUE` | api, worker | `cnes-ingestion` |
| `CNES_FTP_HOST` | worker | `ftp.datasus.gov.br` |
| `CNES_FTP_BASE_PATH` | worker | `/cnes` |
| `CNES_FTP_MODE` | worker | `mock` \| `ftp` |
| `CNES_ARCHIVE_BACKEND` | worker | `local` \| `minio` \| `s3` |
| `CNES_ARCHIVE_LOCAL_PATH` | worker | `/tmp/atlasmed-cnes-archive` |
| `CNES_ARCHIVE_S3_BUCKET` | worker | `cnes-raw` (MinIO dev) |
| `CNES_ARCHIVE_S3_ENDPOINT` | worker | `http://localhost:9000` (MinIO) |
| `CNES_ARCHIVE_S3_ACCESS_KEY_ID` | worker | `minioadmin` (MinIO dev) |
| `CNES_ARCHIVE_S3_SECRET_ACCESS_KEY` | worker | `minioadmin` (MinIO dev) |
| `CNES_LOAD_MODE` | worker | `dev` \| `ftp` |
| `CNES_EXTRACT_DIR` | worker | `/tmp/cnes-extract` |
| `CNES_PYTHON_BIN` | worker | `python3` |
| `CNES_IMPORT_SCRIPT` | worker | Path to `cnes_mapping/scripts/import_modular.py` |
| `CNES_DEV_LOAD_SOURCE_SCHEMA` | worker | `mcp_test` |
| `CNES_VALIDATION_ROW_TOLERANCE_PCT` | worker | `15` |

---

## Out of scope (v1)

- Auto-approve low-risk suggestions
- Geocoding / territory assignment inside ingest workflow
- `registry` history beyond 2 months in Postgres
- Temporal Cloud / prod deployment automation
- Web UI for ingestion dashboard (API only in v1)
- Rewriting CRM fields during ingest (never)

---

## Test plan

1. Start Temporal via docker-compose; worker connects to task queue
2. `POST /registry-ingestion/run` starts workflow; returns `workflowId` + `ingestionRunId`
3. Dev load adapter fills `registry_staging` from `mcp_test`
4. Validation passes on known-good dataset
5. Reconcile creates expected suggestions (field update, deactivation, `FACILITY_PROFESSIONAL_ADD` when one side pre-existed)
6. Promote swap: `registry` reflects new month; `registry_previous` has old
7. CRM metadata sync updates `sourceLastSeenAt` without changing `CRM_OWNED` fields
8. Duplicate `POST /registry-ingestion/run` for same `ano/mes` is idempotent
9. Mock FTP + local archive round-trip stores manifest with checksums

---

## Open items (non-blocking)

| Topic | Notes |
|-------|-------|
| Prod Temporal hosting | Local docker-compose for dev; Temporal Cloud TBD |
| Prod archive | MinIO is interim dev infra; production S3 + lifecycle policies TBD |

## Technical debt (v1 → v2)

Explicit debt tracked in Spec 39 (no separate report). v1 ships hybrid load; v2 replaces Python bridge with TS streaming loaders.

| Debt item | v1 state | v2 target |
|-----------|----------|-----------|
| Staging load | Python `import_modular.py` subprocess (`python-staging-load.activities.ts`) | TS streaming loaders table-by-table in `packages/cnes-ingestion` |
| Parity | Manual / optional local golden fixture | Golden tests: Python vs TS row counts + hashes per table |
| Parse/normalize | Dev-only row-count stub; ftp mode uses CSV preflight only | Full TS parse with transforms (S/N flags, dates, orphan FK nulling) |
| Archive infra | MinIO in `docker-compose.temporal.yml` | Production S3 + lifecycle policies (infra TBD) |
| Worker image | `Dockerfile.dev` bundles Python + pandas | Slim TS-only image after port |
| FTP | Real DATASUS anonymous ZIP download | Retry/backoff tuning, bandwidth observability |

### CNES file naming (canonical)

Monthly dump: `BASE_DE_DADOS_CNES_YYYYMM.ZIP` on FTP path `/cnes`. Extracted CSVs use version suffix (e.g. `tbEstabelecimento202605.csv`, `tbDadosProfissionalSus202605.csv`). Mapping lives in `packages/cnes-ingestion/src/ftp/cnes-file-mapping.ts` (26 CSV importers → 25 warehouse tables).
