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
| Facilities resolvable | active + link in `facility_emultec_clients` and/or unique CNPJ/CPF match (CNES not required) |

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

Links live in `facility_emultec_clients`, keyed on the Emultec client:

```sql
INSERT INTO facility_emultec_clients (id_cliente_emultec, facility_id, source)
VALUES ($<id_cliente>, $<facility_id>, 'MANUAL');
```

**One clinic may hold several clients, and normally does.** Emultec models a
surgeon working out of a clinic as their own pessoa-física row pointing at the
clinic through `Id_Cliente_PJ` — COT Centro Ortopédico has five, and 54 parent
CNPJs carry 175 between them. The reverse is a genuine conflict and the primary
key rejects it: one client resolves to exactly one clinic.

Linking by hand is mostly optional. The importer records a link itself the first
time a clinic is reached by the client's own CNPJ/CPF (`source` = `AUTO_CNPJ` /
`AUTO_CPF`), never repointing a link that already exists. PF→PJ buyers are left
unlinked on purpose: that path matches the *parent* company's CNPJ, a cached
link would win over document matching, and a surgeon who moves clinics would
keep resolving to the old one. Their parent pointer is re-read from Emultec on
every run, so leaving it dynamic costs one lookup and cannot go stale.

`facilities.id_cliente_emultec` is superseded and no longer read. It is kept for
one release as a rollback target and dropped after.

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

Facility resolve: link → PF→PJ CNPJ → CNPJ-14 → CPF-11.

Order type comes from `avulsa.Natureza`, not from status: `VENDA` → `SALE`,
`DOACAO` → `DONATION`, blank → `SALE`, anything else → `OTHER`. About a third of
the whitelist volume is donated product (6 277 orders, ~R$1.8k average against
~R$10.4k for a sale), and the purchase funnel counts only `SALE` /
`CONSIGNMENT`, so donations are now excluded because of what they are rather
than because they happen to carry `SEM FATURAMENTO`. Candidates must be active; a unique match is required (two active facilities on one document → `facility_ambiguous`). CNES registration is not a precondition — requiring it made a facility with an exact CNPJ match invisible to the importer, which excluded individual surgeons and distributors by construction.

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
SELECT COUNT(*) AS links, COUNT(DISTINCT facility_id) AS clinicas
FROM facility_emultec_clients;

-- Clinics holding several clients — expected, not a fault.
SELECT facility_id, COUNT(*) AS clientes
FROM facility_emultec_clients
GROUP BY facility_id HAVING COUNT(*) > 1
ORDER BY clientes DESC;
```
