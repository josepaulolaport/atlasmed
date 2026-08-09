# Ops: Emultec order import

Import whitelist EVISC / REVISCON / TRUVISC lines from Emultec MySQL (`avulsa` → CRM `orders` / `order_items`). Worker package: `apps/workers/temporal`.

**Never seed seller/facility Emultec ids via migrations.** Stamp locally / in each environment with SQL or admin tools.

## Prerequisites

| Requirement | Notes |
|---|---|
| Temporal worker running | `@atlasmed/temporal-worker` on `TEMPORAL_TASK_QUEUE` |
| `DATABASE_URL` | CRM Postgres |
| `EMULTEC_MYSQL_HOST` / `USER` / `PASSWORD` | optional `PORT` (3306), `DATABASE` (`atlasmed`) |
| Docker | worker host must run `docker run --rm mysql:8 …` against Emultec (no `mysql2` dep yet) |
| Products synced | `id_produto_emultec` for whitelist ids |
| Sellers mapped | `users.id_vendedor_emultec` (manual) |
| Facilities resolvable | CNES-eligible + stamp and/or unique CNPJ/CPF match |

## One-time / rare setup

### 1. Product sync

```sh
cd apps/workers/temporal
# DATABASE_URL + EMULTEC_MYSQL_* in env
bun run sync:emultec-products
```

Upserts 12 SKUs + `ORTOPEDIA` vertical link. Idempotent.

### 2. Map sellers (manual)

```sql
UPDATE users
SET id_vendedor_emultec = $<emultec_vendedor_id>, updated_at = now()
WHERE id = $<user_id> AND deleted_at IS NULL;
```

Unmapped `avulsa.Id_Vendedor` → order skipped (`seller_unmapped`).

### 3. Stamp facilities (manual, unique CNES match only)

Set `facilities.id_cliente_emultec` only when Emultec client CNPJ/CPF digits match **exactly one** active CNES facility. **Do not** stamp PF→PJ buyer ids onto the facility (import still resolves via PJ CNPJ).

### 4. Provision daily schedule (after deploy)

```sh
bun run --cwd apps/workers/temporal schedule:emultec-order-import
```

- Schedule id: `emultec-order-import-daily`
- Cron-like: **06:00 UTC** daily, overlap `SKIP`
- Workflow: `emultecOrderImportWorkflow` with `{ mode: "HYBRID", reconcileDays: 30, pageSize: 200, triggerPurchaseRecurrence: true }`

## Modes

| Mode | Behavior |
|---|---|
| `BACKFILL` | Page all whitelist avulsa by `id > afterId` (default 0) |
| `INCREMENTAL` | `id >` CRM `max(orders.id_avulsa_emultec)` |
| `RECONCILE` | Whitelist avulsa with `Data` / `Finalizado_Data` / `Sem_Faturamento_Data` ≥ `since` |
| `HYBRID` (default) | `RECONCILE` then `INCREMENTAL` |

Facility resolve order (all require active + non-empty `cnes_code`):

1. `facilities.id_cliente_emultec = avulsa.Id_Cliente`
2. Else PF→PJ → unique facility on **PJ CNPJ**
3. Else unique facility on client **CNPJ-14**
4. Else unique facility on client **CPF-11** (ambiguous → skip)

Status map: `FATURADO`→`INVOICED`, `APROVADO`→`APPROVED`, `SEM FATURAMENTO`→`NO_BILLING`, `REPROVADO`→`REJECTED`, else `PENDING`. Type always `SALE`. Vertical `ORTOPEDIA`.

## Manual runs

### CLI (direct DB + Docker mysql — no Temporal)

Useful for local smoke / when Temporal is down:

```sh
cd apps/workers/temporal
bun run import:emultec-orders -- --mode=HYBRID --reconcile-days=30 --limit=200
bun run import:emultec-orders -- --mode=BACKFILL --after-id=0 --max-pages=5
```

Idempotent upserts. Safe to re-run.

### Temporal one-shot

```sh
bun run --cwd apps/workers/temporal start:emultec-order-import
bun run --cwd apps/workers/temporal start:emultec-order-import -- --mode=BACKFILL
bun run --cwd apps/workers/temporal start:emultec-order-import -- --mode=HYBRID --reconcile-days=14
```

Stable workflow ids: `emultec-order-import-hybrid` | `-backfill` | `-reconcile` | `-incremental`. Repeat while running → returns existing execution.

## After import — purchase funnel

HYBRID Temporal workflow starts a child `purchaseRecurrenceWorkflow` (`RECONCILE`) when `upserted > 0`.

If funnel looks stale, or CLI-only import was used:

```http
POST /sync
Content-Type: application/json
Authorization: Bearer $ATLASMED_TOKEN

{ "entity": "orders" }
```

That starts purchase-recurrence **BACKFILL** (`purchase-recurrence-backfill`). Inspect with `GET /sync/purchase-recurrence-backfill`.

Hourly purchase-recurrence schedule (separate) also picks up `orders.updated_at` changes:

```sh
bun run --cwd apps/workers/temporal schedule:purchase-recurrence
```

## Failure / recovery

| Symptom | Action |
|---|---|
| Activity fails (MySQL/Docker/DB) | Temporal retries 3×; then fail. Re-run `start:emultec-order-import` or wait for next daily schedule. Upserts are idempotent. |
| Many `seller_unmapped` | Map more `users.id_vendedor_emultec` (product choice may keep few REPs). |
| Many `facility_no_match` | Add/fix CNES facilities + legal docs, or stamp `id_cliente_emultec` on unique matches. |
| Mid-run kill (CLI) | Resume `BACKFILL`/`INCREMENTAL` with `--after-id=<lastId>` or rely on HYBRID watermark. |
| Schedule overlap | `SKIP` — previous daily run still open → that tick skipped. |
| Recurrence child failed | Orders remain; run `POST /sync` `{entity:"orders"}` or wait for hourly recurrence. |

Per-order upsert exceptions are logged (`emultec.order_import.failed`) and counted under `skipReasons.error`; the page continues.

## Sanity SQL

```sql
SELECT COUNT(*) AS orders,
       COUNT(*) FILTER (WHERE status = 'INVOICED') AS invoiced,
       COUNT(*) FILTER (WHERE status = 'NO_BILLING') AS no_billing
FROM orders WHERE id_avulsa_emultec IS NOT NULL;

SELECT COUNT(*) FROM order_items WHERE id_avulsa_item_emultec IS NOT NULL;

SELECT COUNT(*) FROM users WHERE id_vendedor_emultec IS NOT NULL AND deleted_at IS NULL;
SELECT COUNT(*) FROM facilities WHERE id_cliente_emultec IS NOT NULL;
```

## Out of scope (v1)

- Creating facilities / persons / users from Emultec
- Non-avulsa sources (cirurgia, consignado, …)
- Import monitoring UI (use Temporal UI + structured logs)
