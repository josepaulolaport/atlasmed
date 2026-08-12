# Spec 0013 — Potencial de mercado (products, metrics & market share)

**Status:** Accepted (2026-08-10)
**Amends:** ADR 0003 (order keying, per spec 0010 §4) · **Depends on:** spec 0010 (profile as
commercial hub)
**Replaces the feature previously called** `'Potencial & share'`.

---

## 1. What this is

For a clinic × linha, show the **total market** for a product category and **our share of it**:

```
ampolas/mês
   nosso            (dos pedidos, automático)      120/mês
   Concorrente X    (informado pelo rep)            80/mês
   Concorrente Y    (informado pelo rep)            40/mês
   ──────────────────────────────────────────────────────
   mercado total                                   240/mês
   nossa participação                                 50 %
```

Our side is derived from orders. Their side is entered by the rep. The denominator is therefore
**observed and itemised**, not estimated.

This replaces the current model, where `facility_potential_values.quantity` is a single
hand-entered "potential" number and penetração divides sales by that guess.
**`facility_potential_values` is retired** — two sources for one number produce disagreements
nobody can resolve.

---

## 2. Products: one table

**`competitor_products` and `competitor_product_verticals` are dropped.** Competitor rows merge
into `products` with `ownership = COMPETITOR`.

**Rationale.** "Competitor" is not a kind of product — it is a statement about our commercial
relationship to it. Modelling a relationship as a separate table produced two near-identical
tables, two vertical M2M tables, two repositories, two admin surfaces, and a bridging table whose
job is to reconnect what should never have been split. The schema shows the drift directly:
`competitor_products.brasindice_updated_at` exists **without** `brasindice_code`
(`catalog.ts:95`) — a column meaningless without one the table does not have.

```
products
  ownership              OWN | COMPETITOR        (enum, not boolean — a distributed
                                                  third-party line is neither)
  code, simpro_code, brasindice_code, tiss_code   → NULLABLE, partial-unique where not null
  id_produto_emultec                              → kept, nullable
  metric_units                numeric             → §4.2
  … existing property columns unchanged
```

**Nullable codes are a correctness fix, not a relaxation.** `simpro_code` / `brasindice_code` /
`tiss_code` are currently `NOT NULL + unique`, so the Emultec importer invents
`EMULTEC-SIM-{id}` / `EMULTEC-BRA-{id}` / `brasindice_updated_at = '1970-01-01'` purely to satisfy
them. The constraint does not guarantee a Brasíndice code; it guarantees *a string*. Making them
nullable removes the synthetic values and unblocks the real Brasíndice import (item 16), which no
longer has to reconcile against invented data.

**No JSONB attributes.** Considered and rejected as premature — the catalog is a handful of
families of the same kind of product. Adding a JSONB column later is a one-line migration;
removing one after code depends on it is not. Revisit when a product type genuinely does not fit.

### 2.1 Enforcement
- `order_items.product_id` may reference only `ownership = OWN`. ✅ migration `0085`
- `facility_product_usage.product_id` may reference only `ownership = COMPETITOR` — orders are
  authoritative for our quantities, so there is no manual entry for our own products.
  ⏳ the table does not exist until P4-2; `facility_competitor_product_standards`, which it
  replaces, is constrained the same way in `0085` meanwhile.

Both as DB constraints, not application discipline.

**Also enforced in `0085`, and missing from this spec until it was asked for:** an equivalence is
directional, so `product_equivalences.product_id` may reference only `OWN` and
`competitor_product_id` only `COMPETITOR`, and the two ids must differ — a product cannot be its
own competitor. Before `0085` that held only because `LinkCompetitorProductUseCase` resolved each
id through a differently scoped repository; nothing in the schema said it, and a direct insert
could link a product to itself.

**Mechanism.** Each referencing table carries a `GENERATED ALWAYS` column holding the ownership it
accepts, and a composite foreign key onto `products(id, ownership)` — which is why `products`
gained a redundant-looking `unique(id, ownership)`. Generated means no insert can set the column
and no default can drift.

---

## 3. Verticals: option (b)

A product may belong to **several** verticals (`product_verticals` M2M stays), and has **one
definition per (product, vertical)**.

This resolves an existing contradiction: `product_verticals` is M2M while
`product_potential_links` has `product_id` as its **primary key** (1:1), so a product in two
verticals today has a metric in one and none in the other.

`product_potential_links` becomes `(product_id, definition_id)` with a uniqueness rule of one
definition per (product, vertical). Enforce in the database by denormalising `vertical_id` onto
the link with a **composite FK** to `(definition.id, definition.vertical_id)` — the pattern
already used by `territories_id_vertical_id_uidx` and the manager-zone FK.

---

## 4. The metric

### 4.1 Structure

| Table | Owner | Purpose |
|---|---|---|
| `product_potential_definitions` | admin | the metric per vertical (`ampolas_mes`, `label`). **Unchanged.** |
| `product_potential_links` | admin | **our** products → definition (many products : one definition) |
| `product_equivalences` | admin | our product ↔ competitor product |
| `facility_product_usage` | **rep** | (profile, definition, competitor product, **month**) → quantity |
| `facility_metric_snapshot` | system | (profile, definition, **month**) → ours, theirs, total, share |

> **Decisions 2026-08-10 — the rep's entry, and the usage key.**
>
> **The rep types only a number.** The competitor product comes from the picker; the number is the
> quantity of *that product* per month — **product units, not metric units** — and is multiplied by
> that product's `metric_units`, exactly like our side multiplies order lines. Symmetric by
> construction. Since every product sits at `metric_units = 1` until an admin sets real values
> (§4.2), the rep's number passes through unchanged today.
>
> **Uniqueness is (profile, definition, product).** The same competitor product may carry a
> separate quantity under each metric it belongs to. The §7 ambiguity is a *picker* problem, not a
> storage one — the schema stays capable and the UI decides what to offer.

> **Amendment 2026-08-11 — the key gains a month: (profile, definition, product, month).**
>
> The rep's number is a **monthly observation**, not a timeless attribute: they answer *quantas por
> mês*, and that answer is true of a month. Stored without one, today's figure silently became the
> answer for every month ever asked about.
>
> This matters because of an asymmetry. **`ours` already has perfect history** — every past month's
> numerator is exactly recomputable from `orders.ordered_at`, forever. Only `theirs` lacked it. The
> first P4-3 design compensated with a freeze rule (complete months stop being recomputable after a
> three-month tail) so that recomputing March could not write today's competitor number onto it.
> That worked, but it bought an arbitrary freeze horizon, snapshots whose meaning depended on when
> you read them, a trend chart whose last three points moved whenever a rep edited a quantity, and a
> reconciliation sweep promoted from optimisation to correctness — all to paper over one missing
> column.
>
> With the month in the key, every one of those disappears and `facility_metric_snapshot` becomes a
> **derived cache**: truncatable and rebuildable from scratch, deterministically, at any time.
>
> Changed the same day P4-2 merged, while the table had zero rows and no writer
> (`setCompetitorQuantity` had no call sites — the picker is P4-5). It would not have been free
> later.

**`product_equivalences` is used only to populate the rep's picker.** It is not part of the
metric's keying. A usage row, once created, stands on its own — so removing an equivalence does
**not** change any clinic's numbers and does **not** trigger recalculation. Field-collected data
is never invalidated by a catalog edit.

*(`product_equivalences` also continues to back the existing price-comparison feature,
`catalog_comparison_screen`. Same table, unrelated job.)*

`facility_competitor_product_standards` is **replaced** by `facility_product_usage` — it was
facility-scoped, unlinked to metrics, and carried a single `standardized_quantity`.

### 4.2 Units

`products.metric_units numeric` — how many metric units one product unit represents. A box of 5
ampoules → `5`. A single ampoule → `1`.

**This is a correctness fix, not an enhancement.** The current numerator sums
`order_items.quantity` **raw**, so a box of 5 and a single ampoule each count as **1**. Ten boxes
register as 10 ampoules instead of 50. Every share figure computed today is wrong, and wrong
plausibly enough that nobody notices.

Accepted constraint: a product carries one `metric_units` value, so every metric it belongs to
must measure in the same unit. Revisit if that ever fails.

> **Decision 2026-08-10 — the values are admin data, not something we derive.**
> All 12 production products carry `metric_units = 1` (the `0082` default) and an empty `unit`
> text column, so there is nothing in the database to infer a box size from. Three names appear
> twice under different EAN codes (e.g. REVISCON 1.0% as `4064544000182` and `8718802047995`),
> which are plausibly different presentations — but "plausibly" is not a basis for multiplying
> revenue figures.
>
> Phase 4 therefore ships the **mechanism** and leaves every value at 1. Nothing is invented.
> **Until an admin sets real values, the numerator remains understated exactly as it is today** —
> acceptance criterion §9.1 is *not* met by P4-1 alone, and that is deliberate.
>
> **Required of the admin UI (not yet built):** an editable `metric_units` per product, presented
> as "how many metric units is one unit of this product" with the unit label from the definition
> (e.g. *ampolas*). This is the only place the value can come from.

### 4.3 Calculation

Per calendar month M, in the application timezone:

```
ours[M]   = Σ (order_items.quantity × products.metric_units)
            over eligible orders with ordered_at in [M, M+1)
theirs[M] = Σ (facility_product_usage.quantity × products.metric_units)
            over usage rows for month M
total[M]  = ours[M] + theirs[M]
share[M]  = ours[M] ÷ total[M]                 (null when total = 0)
```

The **trailing N-month average is derived at read time** from those stored months — it is not a
stored value:

```
ours_monthly = (Σ ours[M-N+1 … M]) ÷ N
```

> **Amendment 2026-08-11 — store facts, derive views.** The formula previously read
> "over orders for this profile, last N months ÷ N", which is a *rolling window* and cannot be
> stored per month: it depends on when you ask. Three things follow from storing month facts
> instead.
>
> The snapshot row becomes genuinely idempotent — no wall-clock reaches the computation, so
> recomputing month M tomorrow yields exactly today's answer. This is what §4.4 requires of the
> handler and what a reconciliation sweep needs in order to converge at all; a value that drifts
> with the clock would mark every snapshot permanently stale.
>
> "March versus April" is answerable, because that is what is stored.
>
> **Changing N stops being a data migration and becomes a query change.**
>
> It also removes a live distortion: dividing by a constant 3 understated any clinic with fewer
> than three months of orders by up to 3×.

> **Amendment 2026-08-12 — a competitor figure is a standing rate, not a month to average.**
> The distortion named directly above was fixed for `ours` and left in place for `theirs`:
> the read computed `theirs = (Σ theirs[M-N+1 … M]) ÷ N`, so a rep who recorded one competitor at
> 100/mês saw 33. The two months nobody had surveyed were counted as hard zeros — precisely the
> "confident, wrong number" §4.4 refuses when it forbids backfilling months with no usage rows, and
> precisely the distinction the read already honoured for the *all*-empty case by nulling the share.
>
> The rep answers **quantas por mês**, so what they enter *is* the monthly rate. It holds until they
> replace it. The clinic screen therefore reads the **newest row per (definition, product)** and
> sums across products:
>
> ```
> theirs_now = Σ over products of latest(facility_product_usage.quantity) × products.metric_units
> ```
>
> Same product recorded again → replaces. Different product → adds. A figure recorded long ago still
> counts, per §6 — `updated_at` remains the only signal that it is old.
>
> **Removal clears every month the product carries.** With one standing figure per product, the
> months behind it are the dates that figure changed, not separate surveys — so deleting only the
> newest left the one before it standing and the product returned with an older number. Removing a
> competitor means it no longer counts here at all; recording that a clinic uses less is an edit,
> not a removal. Every month it appeared in is recomputed, including months outside the current
> window, because the manager aggregates in spec 0014 §4 read them.
>
> **`facility_product_usage` is unchanged**, month key and all. The month rows are still the history
> the snapshots and the §4.5 trend are built from; `theirs[M]` above still describes a *stored month*.
> What changed is the read behind the clinic screen, which asks a different question: not "what was
> true in each of the last three months" but "what is true now".

> **Amendment 2026-08-12 — our own quantity is shown per product.** §6 gave the rep our total and
> the competitor products behind theirs, with no way to see which of our products made up our own
> number. The read now also returns `ourProducts`: the same 90-day window, grouped by product and
> normalised to a month, largest first, listing only products actually sold in the window.
>
> It is derived from orders, so it is read-only — there is nothing to add, edit or remove. With the
> competitor change above, both lists now sum to the total above them; neither did before.

- **N configurable, default 3**, a single global constant (`MONTHS_IN_WINDOW`) — not
  per-definition, not database-backed. It now lives on the **read** path, where a presentation
  constant belongs. Revisit only when two metrics genuinely need different windows.
- **Month boundaries are `America/São_Paulo`**, not UTC. `orders.ordered_at` is `timestamp without
  time zone` on a UTC server, so UTC bounds would place an order taken 31 March 22:00 in São Paulo
  into April — and the rep who entered it would disagree with the chart. No existing figure moves:
  all 1,131 production orders are Emultec imports stamped at noon UTC, whose date component is the
  same in both zones. It matters for orders created in-app, which carry a real timestamp.
- Eligible orders follow ADR 0003: `status ∈ (APPROVED, INVOICED)`, `type ∈ (SALE, CONSIGNMENT)`.
  **This corrects a live inconsistency** — the penetration query currently filters `type = 'SALE'`
  only while the funnel counts both.
- **Written-off lines are included** (user decision).
- **`CONSIGNMENT` is included** alongside `SALE` (user decision, 2026-08-10) — confirming the
  §4.3 rule against the live query, which filters `type = 'SALE'` only.
- Scoping is structural: orders key on `facility_vertical_profile_id` (spec 0010 §4), so the
  numerator no longer needs — and no longer silently omits — a vertical filter.
- `share` is **null**, never `0`, when there is no data. "No sales" and "no information" must be
  distinguishable.

### 4.4 Storage, history & recalculation

Stored in `facility_metric_snapshot`, not computed per request — so it is dashboardable and
historical. Recomputed on:

1. an order affecting the profile is created, updated, or imported
2. a rep edits a usage quantity
3. a rep adds or removes a competitor product

**Not** on equivalence changes (§4.1).

> **Decision 2026-08-10 — asynchronous for orders, synchronous for the rep.**
> A rep editing a quantity (2) or adding/removing a competitor product (3) recomputes **inline**,
> so the number they just changed is correct when the screen redraws.
>
> Order writes (1) **enqueue** a recompute keyed on the affected profile, deduplicated. The Emultec
> importer upserts tens of orders per run every ten minutes and would otherwise recompute the same
> profile once per order, turning one import into dozens of identical recomputations — and putting
> the metric's cost on the critical path of an importer that must stay a considerate guest of a
> third-party database.
>
> The recompute must be **idempotent**: running it twice for the same (profile, definition, month)
> produces the same row.
>
> **Decision 2026-08-10 — idempotency lives in the handler; correctness lives in a sweep.**
>
> The handler is a **pure function of stored state**: for one (profile, definition, month) it reads
> the orders and usage rows, computes, and UPSERTs that single row. Never a delta, never an
> increment. Run once or fifty times, concurrently or out of order, the row is identical. This is
> what makes at-least-once delivery acceptable.
>
> Transport is `purchaseRecurrenceWorkflow`'s pattern — a Temporal workflow started from the API —
> because an equivalent per-profile derived value already recomputes from orders that way, and one
> convention should cover both.
>
> **But a Temporal start is a network call outside the database transaction.** Commit an order,
> crash before starting the workflow, and that snapshot is never recomputed and nothing reports it.
> A Postgres job table enqueued in the same transaction would close that specific hole, at the cost
> of a second async mechanism — and it would still not survive a call site that simply forgets to
> enqueue, or a script writing rows directly.
>
> So the trigger is **not** where correctness comes from. A **scheduled reconciliation sweep**
> recomputes any (profile, month) whose inputs changed after the snapshot's `computed_at`, compared
> against `max(orders.updated_at)` / `max(usage.updated_at)` for that profile. Consequences:
>
> - a lost trigger costs one sweep interval of staleness, not a permanently wrong number
> - the trigger becomes a latency optimisation, not a correctness requirement
> - the §4.4 backfill command is the same sweep over an explicit month range
>
> ⚠️ The sweep must not scan every profile every run — at ~14k clinics that does not hold up. It
> keys on `computed_at` versus input timestamps, which needs an index, and the query plan must be
> checked against real data rather than assumed.

> **Amendment 2026-08-11 — the snapshot is a derived cache, and the sweep is no longer correctness.**
>
> Once usage carries a month (§4.1), **both inputs have history**, so every row is a pure function
> of stored state for all time — not merely for the recent past. The snapshot table can be
> truncated and rebuilt from scratch, deterministically, and reproduce itself exactly.
>
> What that changes:
>
> - **the sweep drops from correctness to latency.** A sweep that never runs costs staleness, not a
>   wrong number, because the truth is always recoverable from the inputs
> - **the backfill command is just a rebuild** over an explicit month range, not an escape hatch
> - **no month ever changes meaning after the fact** — stability is structural, not a policy
>
> Index reality, measured rather than assumed: `orders_updated_at_profile_id_idx` on
> `(updated_at, facility_vertical_profile_id)` already gives the sweep its range scan.
> `facility_product_usage` has **no `updated_at` index** and needs one before it grows.
>
> **The sweep must still report, not just repair.** It emits `recomputed N, differed M`; a nonzero
> `differed` means a trigger was lost. A sweep that silently corrects is the counter-instead-of-an-
> alarm this codebase has been bitten by before.

**Granularity: one row per (profile, definition, month).** Calendar months, not sliding windows.

Rejected: a row per day. At ~14k clinics × N metrics that is ~15M rows a year, of which the
overwhelming majority duplicate the previous day. Worse, **a sliding 3-month window drifts every
day even with no new orders** — old orders fall out of the window — so daily rows would show
movement that reflects the calendar rather than the market.

Calendar months instead:
- the value changes when something real happens, plus once at each month boundary
- ~14k × 3 × 12 ≈ 500k rows a year
- **comparable** — "March versus April" is a question a sliding window cannot answer
- matches how the rep thinks: they enter *quantas por mês*, so the denominator is months

The current month is partial: show it as **parcial** alongside the last complete month, and plot
only complete months.

> **Decision 2026-08-10 — no historical backfill; snapshots begin at the current month.**
> Backfilling from the 1131 existing orders would produce months with a real numerator and an
> absent denominator (competitor quantities did not exist then), so every reconstructed month would
> read as share = 100%. That is not history, it is an artefact that looks like history.
>
> A **backfill command must still exist**, idempotent and restricted to an explicit month range —
> needed to repair a gap after an incident, and to populate history once competitor data has been
> collected for a period. It is a tool, not part of the migration.

> **Still true after the 2026-08-11 amendment, and for a sharper reason.** With usage keyed by
> month, a backfilled month simply *has no usage rows*: `theirs = 0`, so `total = ours` and
> `share = 100%`. Not a null, not a gap — a confident, wrong number. The rule stands: snapshots
> begin at the current month, and history is populated only for periods where competitor data was
> actually collected.

### 4.5 Historical view

The clinic's Potencial de mercado section offers **"ver mais"** — a per-metric history showing the
trend of our quantity, competitor quantity, total market and share over complete months.

This is why snapshots are retained rather than overwritten. It also feeds the aggregate views in
spec 0014, so a manager can see their share moving over time rather than only its current value.

---

## 5. Emultec: products are never imported

Products come only from admin CRUD. **Delete `upsert-emultec-products.ts`, the
`sync:emultec-products` script, and every product-creation path in the order importer.**

Consequently:
- **`order_items.product_id` becomes `NOT NULL`.** Today it is nullable, so an unrecognised
  product silently inserts a line with a null product — real revenue, invisible to every metric,
  no error raised.
- An order line referencing an unknown `id_produto_emultec` **dead-letters the whole order**, not
  the line. A partially-imported order reports understated revenue as though complete. The
  mechanism exists: `ops.emultec_order_import_dead_letters`, keyed on `id_avulsa_emultec`.
- The DLQ becomes the admin's signal: *this product exists in Emultec and not here — register it.*
- Imported products no longer need synthetic Simpro/Brasíndice/TISS codes (§2).

Also fixed: the importer currently never creates a `product_potential_link` (D-23), which is why
Emultec sales contribute **zero** to penetração today. Under this spec the link is admin-created,
so the gap closes by construction — but existing imported products need linking before their
metrics are correct.

---

## 6. UX

Section renamed **"Potencial de mercado"** (from `'Potencial & share'`,
`clinic_potential_section.dart:34`). ⚠️ `clinic_detail_loading_test.dart:108` asserts the literal
old string and will fail.

**Rep, on the clinic screen:** sees each metric for the active linha with our quantity (read-only,
from orders) **broken down by product**, the competitor products already recorded with their
quantities, the market total and our share. Both product lists are in metric units and each states
the period it covers — ours the 90-day average, theirs what stands recorded. Adds a competitor product — chosen from those equivalent to our products in that metric
— and enters a quantity. Edits or removes quantities.

Each entered quantity shows **"atualizado em <data>"**. Stale figures still count as current
(user decision), so the date is the only signal that a number is old — no logic, just honesty.

Dead UI to remove or wire: `ClinicProductsSection` ("Share na clínica") is never instantiated;
`Professional.prescribing` is hardcoded `const []`, so `_DoctorPrescribing` never renders. Spec
0005 claims both ship in v1 — they do not.

---

## 7. Deferred

- A competitor product reachable from two of our products in **different** metrics is ambiguous.
  Documented, not solved — revisit if it occurs.
- Competitor products not equivalent to any of our products are unreachable in the picker and
  their usage unrecordable. Accepted.
- JSONB product attributes (§2).
- Any manual quantity for our own products (a clinic buying our product via a distributor
  understates our share). Orders are authoritative.

## 8. Defects closed

D-22 (all five penetration defects), D-23, D-31, D-46. Partially D-42 (dead product UI).
See `.ai/backlog/2026-08-09-defect-register.md`.

## 9. Acceptance criteria

1. Ten boxes of 5 ampoules register as **50** ampoules, not 10.
2. A clinic with orders and no competitor data shows share = **100 %**; with neither, share is
   **null**, not 0 %.
3. Adding a competitor quantity changes the snapshot without a request-time recomputation.
4. Removing an equivalence leaves every clinic's numbers unchanged.
5. An Emultec order referencing an unregistered product **dead-letters and raises**, rather than
   inserting a null product.
6. Our quantity and the rep's quantity represent the same period.
7. `order_items` cannot reference a `COMPETITOR` product; `facility_product_usage` cannot
   reference an `OWN` product.
