# Spec 0016 — Data sources for the suggestion engine

Companion to [`requirements.md`](./requirements.md). Answers one question: **what data, ours or
public, would make a suggestion more accurate and a rep more money — and what does each cost?**

The product is intra-articular hyaluronic acid (`EVISC` / `REVISCON` / `TRUVISC`, per
`apps/workers/temporal/src/emultec/whitelist.ts:12`) sold into orthopaedics. That narrows what is
worth pulling: **demand is driven by knee/hip osteoarthritis volume, by whether the facility has
orthopaedic surgeons, and by whether its patients can pay** — viscosupplementation is largely a
convênio/particular procedure, not a SUS one. Every source below is judged against those three.

Sources are ranked by **(value ÷ effort)**, not by how interesting they are.

**Confidence labels.** `verified` = confirmed in this repository. `high` = well-established public
dataset, exact field names still to be checked against the current release. `medium` = the source
exists and is public, but its usefulness for *this* product needs a measurement before anyone
builds on it. Nothing below should be built on a `medium` without the measurement first.

---

## Tier 0 — Already in our database, currently unused

Zero new pipelines, zero legal questions, zero vendor. Highest return in the document.

### 0.1 Orthopaedist headcount per clinic — `verified, measured 2026-08-14`

`packages/cnes-ingestion` already loads `tbCargaHorariaSus` into
**`registry.facility_professional_occupations`** `(facility_cnes_id, professional_cnes_id,
occupation_cnes_id)`. The occupation is a **single exact code, not a prefix**:

```
225270 = MEDICO ORTOPEDISTA E TRAUMATOLOGISTA
```

(Confirmed against `registry.occupations`. The neighbouring `2232xx` codes are dentists and
`3225xx`/`3226xx` are technicians — none of them belong in this count.)

**Measured, and it works.** Clinics with ≥5 orthopaedists buy at 21–26 %; those with ≤4 at
3.6–4.8 %. Buyers average 9.51 surgeons, never-purchased 2.47. Full table in
[`requirements.md`](./requirements.md) §4.9.

**This is no longer "the first quick win" — it is the primary ranking signal.** With 93.8 % of the
book never-purchased and `facility_metric_snapshots` empty, timing and headroom are constants;
capacity is the only component that discriminates across the bulk of the book.

- **Output today:** 129 clinics with ≥5 orthopaedists that have never bought, 65 with ≥10,
  10–40 per rep. That list does not exist in the product.
- **Effort:** one query, one merit component.
- ⚠️ Predictive, not causal — headcount is partly a size proxy. Fine for ranking; not a claim about
  why anyone buys.
- **Not yet loaded:** contracted hours. `tbCargaHorariaSus` carries them and the loader currently
  keeps only the association. Worth adding — a surgeon contracted 40h/week is not the same
  prospect as one contracted 4h.

### 0.2 Product-level gaps in what a clinic buys — `verified`

`order_items` carries `product_id`, `quantity` and `unit_price` per line. We therefore know exactly
which of our SKUs each clinic buys and which it never has.

- **Use:** a `cross_sell` signal — clinic buys `REVISCON 1.0%` monthly and has never bought
  `2.0%` → the visit gets a concrete errand, and the card says which product to pitch.
- This converts a suggestion from "go here" into "go here and sell this", which is the difference
  between a route planner and a sales tool.
- **Effort:** one query. No new data.

### 0.3 Price erosion per clinic — `verified`

`order_items.unit_price` versus the same product's price elsewhere in the rep's book.

- **Use:** flag clinics buying materially below the rep's median. A visit that recovers 4 % of
  price on a recurring account is worth more than most new logos, and nothing surfaces it today.
- **Care:** this is a management-facing number before it is a rep-facing one. Show it as context on
  the stop card, not as a merit component — do not let the algorithm route a rep toward a
  conversation about discounts they may not control.

### 0.4 The surgeon roster we already hold — `verified`

`person_facilities` + `person_healthcare_profiles`, joined to `registry.professionals` on
`cnes_professional_id` (100 % coverage, ADR 0009).

- **Use:** a surgeon who buys at clinic A and also appears at clinic B, where we sell nothing, is
  the highest-probability prospect in the territory — the relationship already exists.
- **This is a genuinely strong signal and costs one join.** `orders.person_id` exists but is
  unpopulated (`purchase-recurrence.ts:306`), so attribution is currently per-clinic; the roster
  join works regardless.

### 0.5 Actual travel times from executed roteiros — `verified` (once §10 lands)

Once roteiros are confirmed and executed, `interactions.actual_started_at` gives real
clinic-to-clinic times for the pairs the rep actually drives.

- **Use:** replace Mapbox estimates with observed medians where we have ≥3 observations. Cheaper,
  and more accurate for this rep, this city, this time of day.
- **Effort:** free — it is a by-product of §10 measurement.

---

## Tier 1 — Inside the ZIP we already download

`packages/cnes-ingestion/src/cnes-files.ts:1` states it plainly: *"Only the seven files below are
read; the dump ships ~90 more that this feature has no use for."* That was true for the
professional-association feature. It is not true for this one.

Adding a file to `CNES_SOURCE_STEMS` + `REQUIRED_COLUMNS` is the entire integration cost. No new
vendor, no new download, no new legal posture — the archive is already in our object store.

| CNES file (verify stem against the 202605 dump) | What it gives | Value here | Confidence |
|---|---|---|---|
| `tbEstabelecimentoAtendPrestConv` (atendimento/prestador/convênio) | whether the unit serves **SUS / convênio / particular** | **The qualifier.** Viscosupplementation is paid privately. A SUS-only unit is not a prospect for this product and should be *demoted*, not just unranked | high |
| `tbEquipamento` + `rlEstabComplementar` | installed equipment, incl. imaging and ultrasound | US-guided injection capability; general capital intensity as a size proxy | high |
| `tbEstabelecimentoHabilitacao` / habilitação link file | formal habilitações, e.g. **alta complexidade em traumatologia e ortopedia** | a hard, government-issued statement that this unit does ortho at volume | high |
| `tbServicoEspecializado` + `rlEstabServClass` | specialised services and their classifications | identifies ortho/rheumatology service lines per unit | high |
| `tbLeito` | bed counts by type | size, and surgical vs outpatient character | high |
| `tbEstabelecimento` extra columns already in the file | phone, e-mail, address, `NU_CNPJ` | **contact enrichment and address repair** — directly fixes the "clinic has no coordinates" exclusion in requirements §4.8 | verified |

**Recommendation:** pull `atendimento/convênio`, `habilitação` and `serviço especializado` in one
batch. Together they turn `PROSPECTAR` from a guess into a filter: *ortho-habilitated, serves
convênio, ≥3 orthopaedists, no orders from us.* That list is the money.

⚠️ **Verify every stem and column name against the archived dump before writing the loader.** The
existing file already documents two traps of exactly this kind — `CO_SUB_TIPO` vs
`CO_SUB_TIPO_UNIDADE` naming the same concept differently, and the two disagreeing council code
systems. Assume more of the same.

---

## Tier 2 — Free public datasets, new pipeline

Real value, real work. Each needs its own ADR-sized decision; none should be started before Tier 0
and Tier 1 are done.

### 2.1 DATASUS procedure volumes — SIH/SUS and SIA/SUS — `medium`

Monthly microdata, per establishment (CNES code), of procedures actually performed and billed.
Public, free, downloadable; `.dbc` format, which needs a converter.

- **SIH (internações)** — arthroplasties, arthroscopies, knee/hip surgery volume per unit. A strong
  osteoarthritis-population proxy.
- **SIA (ambulatorial)** — outpatient procedures, including infiltrations where SUS bills them.

**Honest caveat, and it is the important part:** this is **SUS activity only.** Our product is sold
into the private/convênio channel. A clinic can be a large private orthopaedic practice with almost
no SUS billing, and SIH/SIA would show it as nothing.

So the correct framing is: **a strong positive signal, a meaningless negative one.** High SUS ortho
volume proves the unit does orthopaedics at scale. Low volume proves nothing at all. Any merit
component built on it must be one-directional, or it will systematically penalise exactly the
private clinics we sell to.

**Before building:** join one month of SIH against our existing 14k clinics and measure the match
rate and the correlation with our own order volume. If the correlation is weak, stop. That
measurement is a day of work and it decides whether the pipeline is worth a month.

### 2.2 ANS — health-plan beneficiaries by município/operadora — `high`

Open data from the national supplementary-health regulator: how many people in each município hold
private health cover, by operadora.

- **Use:** a **market-size multiplier per território**, not per clinic. Viscosupplementation is
  paid by plans or by patients; a município with 8 % private coverage cannot support what one with
  35 % can.
- **Best use is not the roteiro at all** — it is territory design and quota-setting for managers
  (spec 0014). A rep with a structurally poor território is being measured unfairly today, and
  nothing in the system knows it.
- **Effort:** low. Municipality-grain, updates quarterly, joins on IBGE code which we already have
  in `registry.municipalities`.

### 2.3 IBGE — population 60+ by município — `high`

Osteoarthritis prevalence rises sharply with age. Population 60+ is the cleanest free denominator
for latent demand.

- **Use:** combined with 2.2 into a single `território potential` figure — *paying population at
  risk*. Same use as above: territory fairness and prospect prioritisation between cities.
- **Effort:** very low, a static table refreshed yearly.

### 2.4 Receita Federal — open CNPJ data — `high`

The full public company registry, republished monthly: situação cadastral (ativa / baixada /
suspensa), CNAE, opening date, capital social, quadro societário.

Three distinct wins:

1. **Dead clinics.** A clinic with `situação = baixada` should never be suggested. Today the only
   way we learn is a rep driving there — which requirements §9 turns into a Não Conformidade, but
   after the wasted trip. This prevents the trip.
2. **New clinics.** A newly opened CNAE 8630-5 (medical practice) in a rep's território is a
   prospect nobody knows about yet, and we would see it the month it registers.
3. **Sócios.** Clinic partners are frequently the surgeons themselves — corroborates the §0.4
   roster and finds the decision-maker.

**Effort:** moderate (large monthly dump, needs staging). **Value: high and immediate on #1 alone.**
⚠️ Quadro societário is personal data about identified individuals. See §4.

### 2.5 Public procurement — PNCP and Banco de Preços em Saúde — `medium`

Public tenders and their results: which institutions bought hyaluronic acid, from whom, at what
unit price, in what quantity, and when the contract ends.

- **Competitor pricing, from the public record.** This feeds spec 0013's `theirs` side with
  something better than a rep's recollection — for the public channel at least.
- **Contract expiry becomes a timing signal.** A hospital whose HA supply contract ends in 90 days
  is a dated, actionable opportunity, and dated opportunities are what this whole feature is built
  to schedule.
- **Caveat:** covers public buyers. Our order book is largely private clinics, so coverage of *our*
  market may be thin. **Measure the overlap against our 14k clinics before committing.**

### 2.6 ANVISA — competitor product registrations — `medium`

Registration holders, product names and registration validity for devices in the same class.

- **Use:** keeps the `products` catalogue's `COMPETITOR` rows honest and complete — spec 0013 §7
  records that a competitor product not present in the catalogue is *unrecordable* by the rep, so
  the catalogue's gaps are silently capping our market-share denominator.
- **A registration lapsing is a commercial event.** So is a new one being granted.
- **Effort:** low-moderate. Feeds the catalogue, not the roteiro directly.

### 2.7 Sociedade Brasileira de Ortopedia e Traumatologia — event calendar — `medium`

Congress and regional meeting dates.

- **Use:** a negative signal the algorithm badly needs. Routing a rep to a clinic whose surgeons are
  all at a congress wastes the day. Suppress or downweight suggestions in affected regions during
  event windows.
- **Effort:** low, and it can be a hand-maintained table of ~20 dates a year. Not every data source
  needs a pipeline.

---

## Tier 3 — Paid or negotiated

State plainly what it costs, and decide with numbers.

| Source | What it gives | Judgement |
|---|---|---|
| **Emultec — beyond orders** | invoices, payment status, inadimplência, credit blocks | **Pull this next.** We already have the MySQL connection (`packages/emultec-mysql`). Sending a rep to close a sale at a clinic that finance has blocked wastes the visit and embarrasses them. A credit-blocked clinic should be *suppressed* with the reason shown. Highest-value non-public source, and the integration already exists. |
| Distributor sell-out data | who our distributors resold to | The single biggest blind spot in spec 0013 (§7 defers it: a clinic buying via a distributor understates our share). Commercially negotiated, not technical. Worth asking for. |
| IQVIA / Close-Up / similar market audits | market size and competitor share by region | Expensive. Only worth it if §2.5 and the rep-entered data in spec 0013 prove insufficient — and spec 0013 was written specifically to make the denominator *observed* rather than bought. Buy nothing until that model has been given a year. |
| Commercial CNPJ enrichment vendors | contacts, phones, decision-makers | Mostly resells §2.4 with a UI. Do §2.4 first, then decide if the gap is worth paying for. |

---

## Not doing, and why

- **Prescription-level or patient-level data.** Health data on identified individuals. Not
  proportionate to routing a sales rep, and the reputational and legal exposure is not close to
  worth it.
- **Scraping doctor profiles, social media, or review sites.** Personal data collected outside its
  original purpose, poor quality, and it would be indefensible if it ever surfaced.
- **Anything inferring a clinic's patients.** We sell to clinics. Modelling their patients is a
  line this product has no reason to cross.

---

## LGPD — the short version

Most of Tier 1 and Tier 2 is establishment-level data about legal entities, which is
straightforward. Two items are not:

- **`registry.professionals` / CNES workload** — named individuals. Already in use under ADR 0006
  and it is public professional-register data, but the existing constraint holds: **CNES suggests, a
  human confirms** (ADR 0004 Q21). Do not let this spec quietly turn a suggestion engine into an
  automated profiling system over named doctors.
- **Receita Federal quadro societário (§2.4)** — named individuals with a documented commercial
  role. Public, and legitimate-interest is arguable, but **get this reviewed before it reaches a
  screen**, and store the minimum: a name and a role, not a dossier.

General rule for everything above: **store the establishment-level fact, not the person-level
trail.** The suggestion engine's inputs should be about clinics.

---

## Recommended order

| Step | Source | Effort | Why now |
|---|---|---|---|
| 1 | §0.1 orthopaedist headcount | hours | Already loaded. Fixes `PROSPECTAR`, which has no signal today |
| 2 | §0.2 product gaps, §0.4 surgeon roster | hours | Turns "go here" into "go here and sell this" |
| 3 | §1 CNES convênio + habilitação + serviços | days | Same ZIP, already downloaded. Turns prospecting into a qualified filter |
| 4 | §3 Emultec credit/payment status | days | Connection exists. Stops wasted and embarrassing visits |
| 5 | §2.4 Receita CNPJ situação cadastral | ~1 week | Stops routing reps to closed clinics; finds new ones |
| 6 | §2.2 + §2.3 ANS + IBGE | ~1 week | Territory fairness and quotas — a manager feature, feeds spec 0014 |
| 7 | §2.1 DATASUS SIH — **measure first** | 1 day to measure | Build only if the correlation with our order volume survives the measurement |
| 8 | §2.5 procurement — **measure overlap first** | 1 day to measure | Build only if it covers a real share of our clinics |

Steps 1–4 need no new external dependency of any kind. They are the ones that make a rep money this
quarter.
