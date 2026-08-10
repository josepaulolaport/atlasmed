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
- `order_items.product_id` may reference only `ownership = OWN`.
- `facility_product_usage.product_id` may reference only `ownership = COMPETITOR` — orders are
  authoritative for our quantities, so there is no manual entry for our own products.

Both as DB constraints, not application discipline.

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
| `facility_product_usage` | **rep** | (profile, definition, competitor product) → quantity |
| `facility_metric_snapshot` | system | (profile, definition) → ours, theirs, total, share |

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

### 4.3 Calculation

```
ours_monthly   = Σ (order_items.quantity × products.metric_units)
                 over orders for this profile, last N months ÷ N
theirs_monthly = Σ (facility_product_usage.quantity × products.metric_units)
total          = ours_monthly + theirs_monthly
share          = ours_monthly ÷ total          (null when total = 0)
```

- **N configurable, default 3.** Both sides must represent the same period — the rep enters a
  monthly figure, so ours must be a monthly average, not a 90-day sum.
- Eligible orders follow ADR 0003: `status ∈ (APPROVED, INVOICED)`, `type ∈ (SALE, CONSIGNMENT)`.
  **This corrects a live inconsistency** — the penetration query currently filters `type = 'SALE'`
  only while the funnel counts both.
- **Written-off lines are included** (user decision).
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
from orders), the competitor products already recorded with their quantities, the market total and
our share. Adds a competitor product — chosen from those equivalent to our products in that metric
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
