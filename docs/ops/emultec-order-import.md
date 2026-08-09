# Ops: Emultec order import

Import whitelist EVISC / REVISCON / TRUVISC lines from Emultec MySQL (`avulsa` → CRM `orders` / `order_items`). Worker package: `apps/workers/temporal`.

**Never seed seller/facility Emultec ids via migrations.** Stamp locally / in each environment with SQL or admin tools.

## Prerequisites

| Requirement | Notes |
|---|---|
| Temporal worker running | `@atlasmed/temporal-worker` on `TEMPORAL_TASK_QUEUE` |
| `DATABASE_URL` | CRM Postgres |
| `EMULTEC_MYSQL_HOST` / `USER` / `PASSWORD` | optional `PORT` (3306), `DATABASE` (`atlasmed`) |
| Docker | worker host must run `docker run --rm mysql:8 …` against Emultec |
| Products synced | `id_produto_emultec` for whitelist ids |
| Sellers mapped | `users.id_vendedor_emultec` (manual) |
| Facilities resolvable | CNES-eligible + stamp and/or unique CNPJ/CPF match |

## One-time / rare setup

### 1. Product sync

```sh
cd apps/workers/temporal
bun run sync:emultec-products
```

### 2. Map sellers / stamp facilities (manual)

```sql
UPDATE users SET id_vendedor_emultec = $<id>, updated_at = now()
WHERE id = $<user_id> AND deleted_at IS NULL;
```

Stamp `facilities.id_cliente_emultec` only on exact unique CNES CNPJ/CPF match. Do not stamp PF→PJ buyer ids.

### 3. Provision 10-minute schedule (after deploy)

```sh
bun run --cwd apps/workers/temporal schedule:emultec-order-import
```

- Schedule id: `emultec-order-import-every-10m` (deletes legacy `emultec-order-import-daily` if present)
- Interval: **every 10 minutes**
- Overlap: **`BUFFER_ONE`** + `catchupWindow: 1h` (failed/missed tick → at most one catch-up)
- Workflow args: `{ mode: "BACKFILL", pageSize: 200, triggerPurchaseRecurrence: true }`
- Paging: MySQL `id > afterId LIMIT 200` per activity (full history walk, not one giant query)
- Note: schedule BACKFILL does **not** run DLQ replay; use API/CLI `HYBRID` or `DLQ_REPLAY` for hard dead letters

## Trigger via API

Requires `manage` on `SEARCH_SYNC` (ADMIN).

```http
POST /sync
Content-Type: application/json
Authorization: Bearer $ATLASMED_TOKEN

{ "entity": "emultec-orders" }
```

→ `202` `{ workflowId, runId, existing }` with stable id `emultec-order-import-hybrid`.

Inspect:

```http
GET /sync/emultec-order-import-hybrid
```

Also allowed: `emultec-order-import-every-10m` and CLI Temporal ids (`-backfill` / `-reconcile` / `-incremental`).

## Modes

| Mode | Behavior |
|---|---|
| `BACKFILL` | Page all whitelist avulsa by `id > afterId` |
| `INCREMENTAL` | `id >` CRM `max(orders.id_avulsa_emultec)` |
| `RECONCILE` | Date window on `Data` / `Finalizado_Data` / `Sem_Faturamento_Data` |
| `HYBRID` (default) | **DLQ replay** → RECONCILE → INCREMENTAL |

Facility resolve: stamp → PF→PJ CNPJ → CNPJ-14 → CPF-11 (unique CNES only).

## Digests and dead letters

Each Temporal HYBRID/API run writes `ops.emultec_order_import_runs` (totals + `skip_reasons` JSON) and logs `emultec.order_import.run_digest`.

Hard upsert exceptions only → `ops.emultec_order_import_dead_letters`. Gate skips (`seller_unmapped`, `facility_*`, …) are digest counts only. Successful upsert clears an open dead letter (`resolved_at`).

Replay stops after `attempt_count >= 10` (`EMULTEC_DLQ_MAX_ATTEMPTS`). Row stays open for ops; log `emultec.order_import.dlq_exhausted`.

```sql
SELECT * FROM ops.emultec_order_import_runs ORDER BY started_at DESC LIMIT 20;

SELECT * FROM ops.emultec_order_import_dead_letters
WHERE resolved_at IS NULL
ORDER BY last_failed_at DESC;

-- Stuck / exhausted (no longer auto-replayed)
SELECT * FROM ops.emultec_order_import_dead_letters
WHERE resolved_at IS NULL AND attempt_count >= 10
ORDER BY last_failed_at DESC;
```

## Manual CLI (no Temporal)

```sh
cd apps/workers/temporal
bun run import:emultec-orders -- --mode=HYBRID --reconcile-days=30 --limit=200
```

### Temporal one-shot (alternative to API)

```sh
bun run --cwd apps/workers/temporal start:emultec-order-import
```

## After import — purchase funnel

Schedule BACKFILL (and HYBRID) start child `purchaseRecurrenceWorkflow` RECONCILE when `upserted > 0` (`triggerPurchaseRecurrence`).

If funnel stale / CLI-only import:

```http
POST /sync
{ "entity": "orders" }
```

## Failure / recovery

| Symptom | Action |
|---|---|
| Activity fails | Temporal retries 3×; run marked `FAILED` in digest; next 10m schedule / BUFFER_ONE catch-up |
| Hard upsert error | Dead-lettered; replayed at start of next HYBRID |
| Many `seller_unmapped` / `facility_no_match` | Digest only — map sellers / fix facilities |
| Mid-run kill (CLI) | Resume with `--after-id` or wait for HYBRID |

## Sanity SQL

```sql
SELECT COUNT(*) AS orders FROM orders WHERE id_avulsa_emultec IS NOT NULL;
SELECT COUNT(*) FROM order_items WHERE id_avulsa_item_emultec IS NOT NULL;
SELECT COUNT(*) FROM users WHERE id_vendedor_emultec IS NOT NULL AND deleted_at IS NULL;
SELECT COUNT(*) FROM facilities WHERE id_cliente_emultec IS NOT NULL;
```
