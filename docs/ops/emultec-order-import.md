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
| Migrations applied | through `0105_emultec_order_import_pending` — apply **before** deploying the worker, or every skip write fails |

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
- Overlap: **`SKIP`** + `catchupWindow: 1m` (a slow run is skipped, never queued behind)
- Workflow args: `{ mode: "HYBRID", pageSize: 200, maxPages: 50, triggerPurchaseRecurrence: true }`
- Paging: MySQL `id > afterId LIMIT 200` per activity (full history walk, not one giant query)
- HYBRID means the schedule *does* replay dead letters and re-check cleared
  skips. A deliberate whole-history walk is still a one-off `BACKFILL` with an
  explicit `maxPages`, not something a 10-minute timer should attempt.

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
| `BACKFILL` | Page all whitelist avulsa by `id > afterId`. Continues into a new run when it fills its page budget, so one trigger covers the whole history. |
| `INCREMENTAL` | `id >` CRM `max(orders.id_avulsa_emultec)` |
| `RECONCILE` | Date window on `Data` / `Finalizado_Data` / `Sem_Faturamento_Data` |
| `SKIP_RECHECK` | Skipped orders whose blocker cleared **in our database**. Reads Emultec only for the ids that flipped. |
| `DLQ_REPLAY` | Open dead letters, by id |
| `HYBRID` (default) | **DLQ replay** → **SKIP_RECHECK** → RECONCILE → INCREMENTAL |

`SKIP_RECHECK` runs before `RECONCILE` on purpose. A skip is almost never
waiting on Emultec — it waits on a rep being mapped, a clinic being created, a
CPF being corrected *here* — and no date window over their data can see any of
that. Its id list comes from our own tables, so a tick where nothing changed
contacts Emultec zero times.

A `BACKFILL` used to restart at `afterId = 0` on every trigger, which with the
shipped defaults covered 5 000 of ~18 500 candidate orders and then re-covered
the same ones forever while reporting success. It now hands over to a fresh run
carrying the cursor, the digest row and the totals (capped at
`MAX_BACKFILL_LEGS`), keeping the inter-page delay across the boundary.

Facility resolve: link → PF→PJ CNPJ → CNPJ-14 → CPF-11.

Order type comes from `avulsa.Natureza`, not from status: `VENDA` → `SALE`,
`DOACAO` → `DONATION`, blank → `SALE`, anything else → `OTHER`. About a third of
the whitelist volume is donated product (6 277 orders, ~R$1.8k average against
~R$10.4k for a sale), and the purchase funnel counts only `SALE` /
`CONSIGNMENT`, so donations are now excluded because of what they are rather
than because they happen to carry `SEM FATURAMENTO`. Candidates must be active; a unique match is required (two active facilities on one document → `facility_ambiguous`). CNES registration is not a precondition — requiring it made a facility with an exact CNPJ match invisible to the importer, which excluded individual surgeons and distributors by construction.

## Digests and dead letters

Each Temporal HYBRID/API run writes `ops.emultec_order_import_runs` (totals + `skip_reasons` JSON) and logs `emultec.order_import.run_digest`.

Hard upsert exceptions only → `ops.emultec_order_import_dead_letters`. Successful upsert clears an open dead letter (`resolved_at`).

Gate skips (`seller_unmapped`, `facility_*`, `products_unmapped`, …) go to
`ops.emultec_order_import_pending` with the blocker each one waits on, and are
re-checked locally every HYBRID run. Deliberately **no attempt cap**: unlike a
dead letter a skip is not failing, it is waiting on data entry that may take
weeks. `blocker = 'NONE'` marks skips only Emultec can fix (`seller_missing`,
`facility_no_document`, `no_whitelist_lines`) — recorded for visibility, never
re-checked.

`facility_ambiguous` rows need a human: two active facilities can legitimately
share a CPF (one surgeon, two consultórios), so they clear by recording a
`facility_emultec_clients` link naming the right clinic, not by deleting a row.

The digest log also carries `changed` — of `upserted`, how many actually wrote a
row. `upserted: 200, changed: 0` is a healthy re-read, not a stall; downstream
purchase-recurrence is triggered on `changed`, so re-reading unchanged orders no
longer recalculates their clinics.

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

-- What the import is waiting on, worst first
SELECT blocker, reason, count(*), min(first_skipped_at) AS waiting_since
FROM ops.emultec_order_import_pending
WHERE resolved_at IS NULL
GROUP BY blocker, reason
ORDER BY count(*) DESC;

-- Ambiguous documents needing an operator to pick a clinic
SELECT p.id_avulsa_emultec, p.id_cliente_emultec, p.blocker_documents
FROM ops.emultec_order_import_pending p
WHERE p.resolved_at IS NULL AND p.reason = 'facility_ambiguous'
ORDER BY p.last_skipped_at DESC;
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

The schedule starts child `purchaseRecurrenceWorkflow` RECONCILE when
`changed > 0` (`triggerPurchaseRecurrence`) — i.e. only when a row actually
moved. It used to fire on `upserted > 0`, which counted orders merely
re-read, so every tick recalculated clinics that had not changed.

If funnel stale / CLI-only import:

```http
POST /sync
{ "entity": "orders" }
```

## Failure / recovery

| Symptom | Action |
|---|---|
| Activity fails | Temporal retries 3×; run marked `FAILED` in digest; next 10m tick picks up (overlap `SKIP`) |
| Hard upsert error | Dead-lettered; replayed at start of next HYBRID |
| Many `seller_unmapped` / `facility_no_match` | Queued in `ops.emultec_order_import_pending`; map the seller or fix the facility and the next HYBRID re-imports them automatically |
| `facility_ambiguous` | Needs a human: record a `facility_emultec_clients` link naming the right clinic |
| Mid-run kill (CLI) | Resume with `--after-id`; a Temporal `BACKFILL` resumes itself |

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
