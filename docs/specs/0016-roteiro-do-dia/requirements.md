# Spec 0016 — Roteiro do dia (visit suggestion, routing & scheduling)

**Status:** Draft (2026-08-14)
**Depends on:** spec 0009 (rep ↔ clinic ownership) · spec 0010 (profile as commercial hub) ·
spec 0013 (potencial de mercado) · spec 0014 (desempenho e equipe)
**Touches:** `apps/mobile`, `apps/api`, `packages/database`, `packages/mapbox`,
`apps/workers/temporal`

---

## 1. What this is, and why it is the missing half of the product

`PRODUCT.md` states the success condition:

> O sucesso é o agente conseguir **decidir o próximo trabalho**, executá-lo com contexto e
> registrar o resultado sem perder tempo operacional.

Executing with context is built (clinic screen, potencial de mercado, orders, interactions).
Registering the result is partly built. **Deciding the next work is not built at all.** Today the
rep opens Explorar, filters by funnel stage, checks share clinic by clinic, opens the map, plans a
route in their head, and hand-creates one calendar event at a time. Every morning. The application
holds every input to that decision and never makes it.

This spec closes that. AtlasMed stops being a system of record and becomes a system of
instruction: *go here, in this order, for this reason, and here is how long the drive is.*

**Nearly all of the machinery already exists and is unused.**

| Input | Where it already lives | State |
|---|---|---|
| When a clinic is due to buy | `facility_vertical_profiles.purchase_funnel_stage`, `next_purchase_funnel_transition_date`, `purchase_interval_days`, `last_valid_purchase_date` | live, recomputed by `purchaseRecurrenceWorkflow` |
| How much volume a competitor holds there | `facility_metric_snapshots.theirs_qty` / `ours_qty` / `share` (spec 0013 §4.6) | live, recomputed nightly |
| Where the clinic is | `facilities.location geometry(Point,4326)` | live |
| Who owns the clinic | `facility_vertical_rep_assignments` (active = `ended_at is null`) | live |
| Drive times between points | `GET /maps/matrix` → Mapbox Matrix | **proxied, tested, zero callers** |
| Rep's free time | `conflict.service.ts` | live |
| Executing a visit | `calendar` + `interactions` (`start` / `complete`, linked orders) | live |
| Which surgeons work where | `registry.facility_professional_occupations` (CBO 225270) | **loaded, zero callers** |
| What kind of unit it is | `registry.facilities.unit_type_code` → `registry.unit_types` | loaded |
| Device GPS | `features/location/data/location_service.dart` | live |

What is genuinely new: a scoring model, a selection/routing algorithm, three tables, one API
surface, one mobile flow, and an outcome field on the interaction.

---

## 2. Scope

### In scope (v1)

1. A ranked, explained slate of clinics to visit, for **today** or **a chosen day**.
2. A **hard, configurable limit** on suggestions per day. Default **5**.
3. **Reachability** — suggestions are filtered to what is actually doable from where the rep is,
   with a self-expanding radius and the distance reached stated on screen (§4.1).
4. **Anchor mode** — "I am already going to clinic X at 10:00; what else is worth it while I am
   there?" Anchors may be an already-scheduled interaction or an ad-hoc point.
5. **Explicit visiting order**, with drive time between each stop.
6. **A map** showing the stops, their order, and the driving route.
7. **Substitution** — swap, remove or add any stop; the slate reorders and re-times itself.
8. **Prospecting is guaranteed by construction** — inactive and never-purchased clinics get
   reserved slots, not just a lower score.
9. **Modality** (`IN_PERSON` / `REMOTE`) is decided per stop and changes both routing and duration.
10. **Confirmation** writes real `calendar` + `interactions` rows with travel-aware start times.
11. **Outcome capture** on completion, so the loop is measurable.

### Out of scope (v1), with reasons

- **Free-form AI chat over the CRM.** See §12. Deliberately excluded, not deferred by accident.
- **Weekly generation and trip planning.** §4.6 and §16.1. One day at a time.
- **Multi-rep / territory-wide optimisation.** One rep's day at a time.
- **Automatic rescheduling when a visit runs long.** The rep re-generates; we do not move their
  calendar behind their back.
- **A general offline layer.** §11 scopes offline to this one screen only.
- **Learned weights.** v1 *measures* everything a learner would need and tunes by hand. Nobody
  tunes what nobody has measured.

---

## 3. Vocabulary

Extends `CONTEXT.md`.

**Roteiro**: an ordered, time-estimated plan of interactions for one agent on one day, generated
by the system and editable by the agent before it is confirmed.
_Avoid_: rota, itinerário, agenda sugerida.

**Parada (stop)**: one clinic in a roteiro, with its position, modality, planned time and the
reasons it was chosen.
_Avoid_: visita sugerida.

**Âncora (anchor)**: a stop whose clinic and time the agent fixed; the engine plans around it and
never moves it.

**Mérito**: the geography-free score of how much a clinic needs a visit now.

**Balde (bucket)**: which commercial job a stop does — `MANTER`, `RECUPERAR`, `PROSPECTAR`. Buckets
carry quotas.

**Ardósia (slate)**: the set of stops for one day, before ordering. Used only in this document; the
UI says "roteiro".

---

## 4. The algorithm

The engine runs in two separated stages. The separation is load-bearing.

```
Stage A — MÉRITO      (no geography)   "how badly does this clinic need me?"
Stage B — SELEÇÃO     (geography)      "which of them fit one working day, in what order?"
```

Merit must not be polluted by drive time, because the rep is shown *why* a clinic was chosen and
"you were nearby" is not a commercial reason. It also lets anchor mode reuse Stage A unchanged.

### 4.1 Candidate set

`facility_vertical_profiles` rows where all hold:

- `is_active = true`
- `vertical_id` = the requested linha
- an active rep assignment to the subject user
  (`facility_vertical_rep_assignments.ended_at is null and user_id = :subject`)
- the facility has a non-null `location` — **a clinic with no coordinates cannot be routed**; it is
  excluded and **counted in the response** (see §4.8)
- no `SCHEDULED` or `IN_PROGRESS` interaction for this profile inside the requested window
- last `COMPLETED` interaction older than `cooldown_days` for its bucket
  (defaults: `MANTER` 14, `RECUPERAR` 21, `PROSPECTAR` 30)

Scope is enforced through the existing `ScopeContext` / `buildFacilityListScope` path, not
re-derived here.

#### Reachability — two modes, both anchored on where the rep actually is

**Candidates must be within reach before merit is considered**, and reach is defined by which of
two questions the rep is asking (user decision, 2026-08-15).

**Mode LIVRE — "what should I do today?"** The rep is somewhere; find work around them.

```
ST_DWithin(facility.location, gps, reach_radius_km)
```

**Mode ÂNCORA — the rep already has visits booked.** *Derived from their calendar, never declared*
(user decision, 2026-08-15): the app made those bookings, so asking the rep to name them is asking
for data we hold. Each booked interaction becomes a **fixed point** — it pins the clock *and* the
map, because the rep is already driving there.

They will make those drives regardless, so everything *along* them and *around* each destination is
nearly free. One expression covers both, applied to every leg
`[gps → booking₁, booking₁ → booking₂, …, last → last]`:

```
dist(gps, C) + dist(C, anchor)  ≤  dist(gps, anchor) + detour_budget_km
```

That is an **ellipse with two consecutive fixed points as its foci**, and a clinic is reachable
when it falls inside *any* leg's ellipse — which is exactly "on the way to something I am already
doing". The final self-leg keeps the area around the day's last booking reachable, so a rep whose
last visit is at 16:00 is still offered work near it. A clinic directly on the route adds
almost nothing and is always included; one off to the side is included exactly while the detour it
costs stays inside the budget. It needs no corridor buffers and no special case for "near the
destination" — the region around the anchor is already inside the ellipse.

Measured on rep 3's book with a 5.5 km anchor drive: a 5 km budget admits 22 candidates, 10 km → 47,
20 km → 81, 40 km → 139. `detour_budget_km` defaults to **20** and lives in `roteiro_params`.

In both modes, if the reachable set yields fewer than `4·N` candidates the bound **expands in
steps** — ×2, ×4, ×8 — stopping at the first step that clears the bar, and **the bound actually used
is reported**. "Your nearest suggestion is 90 km away" is a fact about the rep's day, not an
implementation detail.

**This is a correctness fix, not a tuning knob.** §4.5 shortlists the top `K` candidates *by merit*
and only then asks Mapbox for travel times. On a compact book that is harmless. On a spread one it
is broken, and measurably so: with reachability off, a rep standing in **Belém** is offered Porto
Velho (37 orthopaedists), Parauapebas, São Luís and Manaus — every one scoring well, not one
reachable that day. With it on, the same query returns six clinics in Belém and Barcarena, all
within 18 km.

Straight-line first because it is free and Matrix is not; Stage B then refines with real driving
times and drops whatever does not fit the day.

> **GPS is required, and there is no fallback to a stored or averaged position.**
>
> An earlier draft fell back to a base address and then to a centroid of the rep's territories. The
> centroid idea was measured and is actively harmful: a centroid of scattered geometry lands in
> **empty space**. Using each rep's own book centroid as origin, reps 5 and 6 have **zero**
> candidates within 120 km, and rep 6 has **one** within 250 km — their centroid is a point in the
> middle of the Amazon. Worse, the step-expansion above would have hidden it, growing the radius
> until something appeared and presenting a 700 km drive as a suggestion.
>
> Both modes now start from the rep's live position, so the question does not arise. If GPS is
> unavailable the feature says so and asks for it, rather than guessing from an average of places
> the rep is not.
>
> **Consequence, accepted:** a roteiro can only be generated for *now*, not for a future day. That
> follows from the same decision that deferred weekly planning (§4.6) and keeps the feature honest —
> a plan built from where the rep will hypothetically be is a plan built on a guess.

> **Deliberately unsolved: the genuinely spread book.** Reachability keeps rep 6's day honest — Belém
> clinics while they are in Belém — but does not answer *which city to fly to next*. That is trip
> planning, a different question, and out of scope (§16.1).

### 4.2 Merit components

Each component yields `0..1`. All are computed in one SQL pass over the candidate set.

**a) Timing — `t`.** From the purchase funnel, as a *ramp*, not a stage lookup.

```
r = daysSince(last_valid_purchase_date) / purchase_interval_days

t(r) =  0.10                       r < 0.35      (they just bought)
        0.10 + 0.90·(r-0.35)/0.15  0.35 ≤ r < 0.50
        1.00                       0.50 ≤ r ≤ 1.20   ← the window
        1.00 - 0.45·(r-1.20)/0.80  1.20 < r ≤ 2.00
        0.55 - 0.20·(r-2.00)/1.00  2.00 < r ≤ 3.00
        0.35                       r > 3.00
      = 0.50                       last_valid_purchase_date is null (NEVER_PURCHASED)
```

Why a ramp: two clinics both in `PURCHASE_WINDOW` are not equally urgent — one entered it
yesterday, one is 40 days in and about to churn. The stage enum discards exactly the distinction
the rep acts on. The ramp peaks *just before* the expected order, because the point of the visit is
to be there when the decision is made, not after.

⚠️ `purchase_interval_days` is the **clinic's** interval, not a buyer's — see the note in
`purchase-recurrence.ts:284`. Clinics with many surgeons read structurally shorter. Accepted: the
question "when does this clinic next order" is the one a rep acts on.

**b) Headroom — `h`.** The winnable volume, from `facility_metric_snapshots.theirs_qty`, summed
over the profile's metrics.

```
h = percentile_rank(Σ theirs_qty) within the candidate set
h = HEADROOM_UNKNOWN (default 0.40) when the profile has no snapshot row
```

Normalise by **percentile within the rep's own candidate set**, never by a global maximum: one
outlier clinic would flatten every other clinic to near zero.

**Unsurveyed clinics must remain reachable.** A null snapshot means nobody has ever recorded the
competition there. Scoring that as 0 guarantees the algorithm never sends the rep to the clinics it
knows least about — precisely backwards. `HEADROOM_UNKNOWN` sits at the 40th percentile and the
stop card says *"potencial não medido"*, which makes surveying it the visit's job.

**c) Neglect — `n`.**

```
cadence = clamp(purchase_interval_days, 21, 90)
n = min(1, daysSince(last COMPLETED interaction) / cadence)
n = 1.0 when there has never been one
```

**d) Account value — `v`.** `percentile_rank(Σ ours_qty)`. Defending revenue is work too.

**e) Risk — `k`.** `CHURN → 1.0`, `INACTIVE → 0.6`, otherwise `0`.
`INACTIVE` scores below `CHURN` on purpose: churn is recoverable, inactive is a long shot. The
*reach* of inactive clinics is guaranteed by the §4.3 quota instead, which is the honest mechanism
— inflating a score to force coverage makes every explanation a lie.

> **No cadastro/conformity component** (user decision, 2026-08-14). An earlier draft scored
> `conformity_status <> 'COMPLETE'` as revenue at risk. The premise is false on the real data:
> **every one of the 1 442 profiles is `UNREGISTERED`, including all 89 that buy.** Clinics order,
> get approved and get invoiced in that state, so incomplete cadastro is not blocking revenue and
> is not a reason to route a rep. It was also a constant, and would have contributed nothing but a
> misleading sentence on the stop card.
>
> Cadastro remains a real workflow; it is simply not an input to *where to go today*.

**Further components not in v1** — whether the unit serves convênio at all, product-level purchase
gaps, contracted hours per surgeon, and credit blocks from Emultec. Each would add a term to the
sum below. They are catalogued, ranked by value ÷ effort and sequenced in
[`data-sources.md`](./data-sources.md).

**f) Capacity — `c`.** How much orthopaedic capacity the facility has, from
`registry.facility_professional_occupations` where `occupation_cnes_id = '225270'`
(*MEDICO ORTOPEDISTA E TRAUMATOLOGISTA*).

**Two numbers, not one** (added 2026-08-15 — see [`design-review-2026-08-15.md`](./design-review-2026-08-15.md) §1):

```
count = distinct orthopaedists at the facility
ratio = count ÷ distinct professionals of any occupation there

c = 0.6 · percentile_rank(count) + 0.4 · percentile_rank(ratio)
```

This is not an enrichment. **It is the component that discriminates for 94 % of the book** (§4.9),
and both halves are measurably predictive. Count: clinics with ≥5 orthopaedists convert at 21–26 %,
those with ≤4 at 3.6–4.8 %. Ratio, measured **inside the ≥5 band the count alone treats as equal**:

| orthopaedists as a share of all staff | clinics | buyers | % |
|---|---|---|---|
| ≥40 % | 99 | 32 | **32.3** |
| <40 % | 70 | 8 | **11.4** |

Nearly 3× separation the count cannot see. A hospital with 120 physicians of whom 3 are
orthopaedists is not the prospect a clinic with 14 of whom 12 are is, and ranking on headcount puts
the hospital first.

Ratio is also the **general** form of a defect patched narrowly by §4.2g: ITO AM, a staffing
cooperative with 131 registered surgeons, topped the raw-count ranking and had to be demoted by
unit type. Ratio catches that whole class of facility without enumerating it.

Both halves are percentile-ranked within the candidate set, which also removes any need for the
logarithmic damping an absolute count would require — rank does not care that one facility has 131
surgeons and the next has 24.

**g) Fit — `q`.** How well the facility's CNES **unit type** matches who actually buys from us.
Measured conversion by type (§4.9):

| unit type | clinics | buyers | % |
|---|---|---|---|
| Clínica/Centro de Especialidade | 570 | 55 | **9.6** |
| Policlínica | 180 | 9 | 5.0 |
| Hospital Geral | 141 | 5 | 3.5 |
| Consultório Isolado | 504 | 17 | 3.4 |

**The mapping is data, not code** (user decision, 2026-08-15). `roteiro_params.unit_type_policy`
holds one row per CNES unit type, editable by ADMIN/OPS without a deploy:

```jsonc
{ "Clinica/Centro de Especialidade": {"fit": 1.00, "eligible": true,  "forceRemote": false},
  "Hospital/Dia - Isolado":         {"fit": 1.00, "eligible": true,  "forceRemote": false},
  "Policlinica":                    {"fit": 0.55, "eligible": true,  "forceRemote": false},
  "Consultorio Isolado":            {"fit": 0.35, "eligible": true,  "forceRemote": false},
  "Hospital Especializado":         {"fit": 0.35, "eligible": true,  "forceRemote": false},
  "Hospital Geral":                 {"fit": 0.15, "eligible": true,  "forceRemote": false},
  "*":                              {"fit": 0.05, "eligible": true,  "forceRemote": false} }
```

Three independent levers per type, because the three questions are genuinely different:

- **`fit`** — how far down the ranking it sits
- **`eligible`** — whether the engine may propose it at all; `false` removes the type from the
  candidate set **and from the coverage denominator**, so a type nobody wants visited does not
  quietly wreck the cobertura metric
- **`forceRemote`** — the type is proposed as a phone contact unless the rep overrides. Aimed at
  **Consultório Isolado**: 504 clinics, 35 % of the book, 3.4 % conversion, typically one surgeon.
  Rarely worth a drive on its own, well worth a call in a day-edge slot.

Defaults ship as above — every type eligible, none forced remote — so behaviour is the measured
ranking until someone deliberately changes it. `"*"` is the fallback for any type not listed,
which is what catches staffing cooperatives and administrative units without enumerating them.

> **Hospitals sit deliberately below what conversion alone would justify** (user decision,
> 2026-08-15: *"I don't want to recommend hospitals as much as I recommend clinics"*). Measured,
> Hospital Geral converts at 3.5 % against a specialist clinic's 9.6 % — 2.7× — while `fit`
> penalises it by over 6×.
>
> The gap is a commercial judgement and is recorded as one rather than left looking like a
> mis-calibration: a hospital visit costs more of a rep's day in access, waiting and gatekeeping,
> and purchasing is centralised and slower, so an equal-probability hospital visit is still worth
> less than an equal-probability clinic visit. The §4.2f ratio now penalises general hospitals a
> second time and independently, because their orthopaedists are a small share of a large staff.
>
> `Hospital Especializado` deliberately does **not** follow it down — an orthopaedic specialty
> hospital is a different proposition, and the sample is far too small to say more (2 clinics at
> ≥5 orthopaedists, 1 of them a buyer).
>
> If ranking them down proves insufficient, two stronger levers need no deploy: `eligible: false`
> removes the type from suggestions **and from the cobertura denominator**, and `forceRemote: true`
> keeps it reachable as a phone contact costing no drive time.

⚠️ Unit-type names come from `registry.unit_types.name` and are **CNES's strings, not ours**. A
reload that renames one silently drops it to the `"*"` default. The params editor must therefore
offer the current catalogue as a picker rather than accepting free text, and a policy key matching
no known unit type must be reported, not ignored.

**Capacity without fit is actively misleading**, and the measurement caught it. Ranked on
orthopaedist headcount alone, the top untapped clinic in the whole book is **ITO AM** — 131
surgeons, and a *Cooperativa ou Empresa de Cessão de Trabalhadores na Saúde*. A staffing
cooperative is where surgeons are **registered**, not where product is bought. General hospitals
have the same shape: they aggregate registrations, and they are 38 % of the raw ≥5 list while being
3.5 % likely to buy.

Applying fit turns a list headed by a staffing co-op into one headed by Instituto Cohen, Ortocity,
CEOT, Ortovida, Hospital Ortopédico, Cortrel and COT. Same data, one join.

```
mérito = w_t·t + w_h·h + w_n·n + w_v·v + w_k·k + w_c·c + w_q·q        Σw = 1
```

**Default weights** (per vertical, tunable — §6.3), set from the §4.9 measurement:

| w_t | w_h | w_n | w_v | w_k | w_c | w_q |
|---|---|---|---|---|---|---|
| 0.16 | 0.10 | 0.12 | 0.06 | 0.07 | **0.27** | **0.22** |

> ⚠️ **On day one, five of these seven components are constants.** Timing is flat for the 93.8 %
> that never purchased; headroom is `HEADROOM_UNKNOWN` for everyone because
> `facility_metric_snapshots` is empty; neglect is 1.0 for everyone because `interactions` and
> `visits` both hold **zero rows**; account value is 0 for 94 %; risk is 0 for 95 %.
>
> **What actually ranks the book at launch is capacity × fit** — the two components measured to
> work (§4.9). That is not a flaw to hide; it is the honest description of a book nobody has
> visited yet. Every other component switches itself on as the data arrives: the first visits make
> neglect vary, the first competitor surveys make headroom vary, the first orders make timing vary.
> The weights above anticipate that and are deliberately not tuned to make today's constants
> disappear.

> **These are not the weights this spec was first drafted with**, and the difference is the whole
> argument for measuring before building. The original set put `w_t = 0.34` and `w_h = 0.22` — 56 %
> of the total — on timing and headroom. Against the real book those two components are **constant
> for almost every clinic**: 93.8 % of profiles have never purchased, so timing collapses to its
> flat `NEVER_PURCHASED` value, and `facility_metric_snapshots` is empty, so headroom is
> `HEADROOM_UNKNOWN` for 100 % of rows. A constant component does not rank anything; it only
> rescales. The engine would have shipped ranking on neglect alone and looked broken.
>
> The weights above will be wrong again once the book matures and those components start varying.
> That is expected and it is why they are data, not code. Re-fit when the funnel fills.

### 4.3 Buckets and quotas — the prospecting guarantee

A pure merit ranking is a greedy machine that revisits the same profitable clinics forever. The
slate is therefore **composed**, not merely ranked.

| Bucket | Membership | Default slots (N=5) |
|---|---|---|
| `MANTER` | `OUTSIDE_WINDOW`, `PURCHASE_WINDOW` | **1** |
| `RECUPERAR` | `CHURN`, `INACTIVE` | **1** |
| `PROSPECTAR` | `NEVER_PURCHASED` | **3** |

> **Inverted from the first draft, for the reason in §4.9.** The original 3/1/1 assumed a
> maintenance book. The real one holds **42 `MANTER`-eligible profiles across all five reps** —
> about eight each. At three `MANTER` slots a day a rep exhausts their entire maintenance list in
> three days, and the §4.1 cooldown then blocks it for fourteen. Meanwhile 1 353 clinics have never
> bought, 129 of them with five or more orthopaedic surgeons.
>
> This book is a prospecting book. The quotas say so.
>
> ⚠️ **Ratios must be revisited as the funnel fills** — they encode the current shape of the book,
> which is exactly the thing this feature is meant to change. A quarterly check belongs in the §9
> manager surface, not in someone's memory.

### 4.3.1 Coverage — a stated objective, and it needs its own mechanism

**Coverage is a first-class goal of this feature, alongside revenue** (user decision, 2026-08-14):
reps must reach clinics they have never visited and clinics that have gone inactive, not only the
ones most likely to order this month.

Scoring alone cannot deliver that, and the measurement shows exactly why. The neglect component
`n` was meant to carry coverage — but `interactions` and `visits` both hold **zero rows**, so `n`
is 1.0 for every clinic in the book and discriminates nothing. Even once visits accumulate, a
merit ranking will keep returning the same high-capacity clinics: a clinic that scores 12th every
day is never visited, and nothing in the score ever changes that.

So coverage is a **rotation**, run alongside the quotas:

```
roteiro_stops adds nothing; facility_vertical_profiles gains:
  last_suggested_at   timestamptz null    -- set when a stop is CONFIRMED, not when generated
```

- Each profile carries a **coverage horizon** — default 180 days for `PROSPECTAR`/`RECUPERAR`,
  90 for `MANTER`, per `roteiro_params`.
- A profile whose `last_suggested_at` is older than its horizon (or null) enters the
  **overdue-for-coverage** pool.
- **One slot per slate is drawn from that pool**, highest merit first, taken from the
  `PROSPECTAR` allocation. It is the coverage slot and the card says so: *"Ainda não visitada"* or
  *"Sem visita há 8 meses"*.
- The pool is ordered by `last_suggested_at` ascending **then by assignment age descending**, so
  the book is walked, not sampled. A rep cannot end a year having never been offered a clinic they
  own.

**Assignment age breaks the tie among the never-covered** (added 2026-08-15,
[`design-review-2026-08-15.md`](./design-review-2026-08-15.md) §2). Every clinic a rep has never
been committed to has `last_suggested_at = NULL`, which is one enormous tie — and today that is the
*entire book*. A clinic handed to a rep 180 days ago and still unvisited is more overdue than one
handed over last week, and `facility_vertical_rep_assignments.started_at` already records the
difference. It is a sort key, not a migration.

⚠️ **It carries no signal yet**: all 1 442 assignments were written in a single bulk operation on
2026-08-09, so every assignment age is identical. Build it regardless — it starts discriminating
the first time a book changes hands, and an ordering nobody recorded cannot be reconstructed later.

**Why `last_suggested_at` is set on confirm, not on generation.** A clinic that appears in a draft
the rep discards has not been covered, and marking it covered would let the book quietly rot behind
a rep who regenerates ten times a morning.

**The manager number this produces** (§9): *cobertura* — the share of a rep's book confirmed at
least once within the horizon. That is the metric that says whether the stated objective is being
met, and it is not derivable from revenue.

⚠️ Coverage and revenue genuinely compete for slots. This spec resolves it by **reserving** one
slot rather than by weighting, because a weight can always be outbid by a large enough account and
a reserved slot cannot. If a manager wants more coverage, they raise the reservation, and the trade
they are making is visible.

Quotas are **targets, not floors.** If a bucket has no eligible candidate, its slot spills to the
next bucket by merit — and **the response states which quota went unfilled and why**. A slate that
silently drops prospecting looks identical to one where prospecting was impossible; per
`AGENTS.md` § *Never let a failure become silence*, the two must be distinguishable on screen.

Quotas scale with N: `slots_bucket = max(1, round(N × ratio_bucket))`, ratios normalised, remainder
to `MANTER`. At N=1 the buckets rotate across days so a rep on a one-visit-a-day cadence still
prospects — the rotation cursor lives on `roteiro_params_state`.

### 4.4 Modality — REMOTE is a routing decision, not a label

Each stop carries a recommended `modality`. It changes the cost model:

| | travel cost | default service minutes | position in route |
|---|---|---|---|
| `IN_PERSON` | Matrix drive seconds | 45 | routed |
| `REMOTE` | **zero** | 15 | fills slack: day edges, or gaps too short for a drive |

Default recommendation — `REMOTE` when any holds:

- `drive_seconds(origin → clinic) > remote_threshold_seconds` (default 2700 = 45 min) **and**
  merit is below the slate's 75th percentile
- bucket is `RECUPERAR` or `PROSPECTAR` **and** drive exceeds half the threshold — a cheap first
  touch before burning a half-day on a clinic that may not receive
- the last two `IN_PERSON` interactions for the profile ended `NOT_COMPLETED` — they do not receive

The rep may flip any stop's modality; the flip re-times the day and **is recorded** (§10).

Why this earns its place: converting one 90-minute round trip into a 15-minute call buys back an
entire extra in-person visit. That is the single largest time lever in the feature.

### 4.4.1 The day is a set of gaps, and they are not interchangeable

A rep is in one of four situations, and they are one structure — a **gap**, bounded by whatever
they are already committed to at each end:

| situation | `from` | `to` |
|---|---|---|
| free day | GPS | — |
| before the first booking | GPS | that booking |
| between two bookings | the earlier | the later |
| after the last booking | that booking | — |

A gap with a `to` is **bounded at both ends**: anything placed in it must still leave time to reach
the next commitment, or the rep is late to something they already promised. A gap without one runs
to the close of the working day and only has to fit going in.

**The cost of a clinic is the detour it adds to that stretch**, not its distance from the rep:

```
added = travel(cursor → C) + travel(C → next commitment) − travel(cursor → next commitment)
added = travel(cursor → C)                                    on an open tail
```

So the same clinic is cheap after the last booking and expensive squeezed between two morning ones.
That distinction is the whole reason gaps are modelled at all.

> **Replaces a single cursor walking forward from the origin.** The first implementation chose
> stops in one chain and pushed each past whatever it collided with, which has two failures a rep
> would notice immediately: a clinic suited to the afternoon leg gets scheduled into the morning,
> and nothing ever checks that the rep can still reach their next booking on time. Widening a
> booking's block by its travel — the fix before this one — hid the second symptom without
> addressing it.
>
> Selection and placement are now the same decision: the engine picks the best **(clinic, gap)**
> pair, so a stop knows where in the day it goes at the moment it is chosen and no later pass can
> disagree.
>
> A candidate that fits no gap is simply not chosen, which is how "the day is already full" and
> "there is nothing near the 11:00 slot" become the same correctly-handled answer (`DAY_FULL`).

### 4.5 Stage B — selection and ordering

The objective is **merit per hour**, not shortest route. This is an orienteering problem, so
Mapbox's Optimization API cannot be used for selection — it solves TSP over a set already chosen.
We use **Matrix** for the numbers and select ourselves.

```
1. Shortlist: top K = min(24, 4·N) by mérito **within the reachable set** (§4.1). [one SQL query]

2. Travel: ONE Mapbox Matrix call over [origin, anchors…, shortlist…]
   profile = mapbox/driving  (driving-traffic caps at 10 coordinates; driving allows 25)
   annotations = duration
   → symmetric-ish duration matrix, seconds

3. Seed the route with the anchors, at their fixed times. Route may start empty.

4. Greedy insertion by gain, until N stops or the day budget is exhausted:

     for each remaining candidate c, each insertion position p:
         Δcost(c,p) = added_drive_seconds(p, c) + service_seconds(c)      [0 drive if REMOTE]
         gain(c,p)  = mérito(c) · quota_multiplier(c) / (Δcost(c,p) + τ)

     insert argmax(gain).  τ = 900s — stops division blowing up at zero distance
                                       and tunes how much detour merit is worth.

     quota_multiplier(c) = 1.00  while c's bucket still has an unfilled slot
                           0.35  once its bucket is full
     → soft quotas fall out of the same loop; no second pass.

5. **Exact re-ordering within each gap.** Greedy selection answers "is this clinic worth the
   detour right now", which is the right question for choosing and the wrong one for
   sequencing — it commits to an order before knowing what else is coming.

   Measured on a clear day across the five reps, greedy alone landed exactly on the optimal
   route for two of them and up to **55 % above it** for another: Brasília drove 14.3 km where
   9.2 km would do. Re-ordering each gap's stops onto the shortest route through it brings all
   five to the optimum, and cuts total driving across the five from 139 to 115 minutes.

   Reordering is **per gap**. A stop cannot cross a booking — the commitments at each end are
   fixed in time, so moving a suggestion past one would put the rep in two places at once. And
   the stops are re-timed afterwards, because changing the order changes the drive to each one
   and a plan must never show times its own route contradicts.

   An exact search rather than 2-opt: at a daily limit of 5, and a hard ceiling of 12,
   brute force over a gap is cheaper to reason about and strictly better.

6. Feasibility: Σ drive + Σ service must fit
      workday window  −  existing calendar commitments  −  lunch block.
   Stops that do not fit are dropped from the tail and reported, never silently truncated.

   **Existing commitments are read through `GetCalendarAvailabilityUseCase`**, so recurring
   events expand by the calendar's own rules — a weekly block falling today is busy today, and
   re-deriving that here would be a second expansion to keep in sync. Lunch is just another
   entry in the same list; a stop is pushed past whichever block it overlaps, repeatedly,
   because clearing one can land it inside the next.

   Skipping this produces a plan that **cannot be confirmed**: §7.3 refuses to shift a rep's
   times, so every stop overlapping something already booked returns a 409. A slate that fails
   at the moment of acceptance is worse than a shorter one.

   **Travel to and from a booked visit is included**: its block is widened by the estimated
   drive on each side, so a suggestion never lands in minutes the rep is actually on the road.
   A stop scheduled right before a booking across town would otherwise look fine on the clock
   and be impossible in the car.

   **A personal block is busy time only** — there is nowhere to be, so it constrains the clock
   and not the route.

   Stops that would end after `workday_end` are **dropped from the tail and reported**
   (`DAY_FULL`), never compressed. Shortening or overlapping visits produces a schedule the rep
   cannot keep, and a slate that quietly returns two stops when five were asked for reads as a
   thin territory rather than a full day.
```

**τ, and what it means.** τ = 900s says: a clinic reachable with no detour is worth the same as one
15 minutes away with double the merit. Raising τ makes the rep travel further for quality; lowering
it packs the day tighter. It is the feature's single most legible tuning knob and belongs in
`roteiro_params`.

### 4.6 Weekly mode — deferred

**Cut from v1** (user decision, 2026-08-15): *"Lets not think of the week yet. That would be
overcomplicating things."*

One day at a time. The engine plans **today, or a chosen single day**. Everything the weekly design
needed — k-medoids day-clustering, cross-day deduplication, a non-GPS origin for future days —
leaves the critical path with it.

`users.base_location` (§5.3, §6.1) **stays**, because planning tomorrow from home still needs an
origin that is not the rep's current GPS position, and because the reachability filter needs
somewhere to centre when GPS is unavailable.

`roteiros.week_group_id` stays in the schema as a nullable column. It costs nothing, and adding a
column later to a table with confirmed roteiros in it is more disruptive than carrying an unused
one. Nothing writes it in v1.

### 4.7 Substitution

- **Trocar** on a stop → alternatives are recomputed with that *position vacated*, ranked by
  `gain(c, p)` at that position — not by global merit. What fits there is a different question from
  what scores highest. Return 5.
- **Remover** → slate shrinks, remaining stops re-time.
- **Adicionar** → search any in-scope clinic; inserted at its best-gain position.
- Every change re-runs steps 4–6 for the affected suffix and returns the whole recomputed slate.
  The client never recomputes times locally — the numbers must have one source.
- Every substitution writes a `roteiro_stop_rejections` row. This is the training signal and the
  data-quality channel (§10).

### 4.8 Degradation — the feature must not fail in the field

| failure | behaviour |
|---|---|
| Mapbox unreachable / not configured | fall back to `haversine × 1.35` road factor; every time on screen is labelled **estimado**; the map draws straight lines, not a route |
| No GPS / permission denied | origin = `base_location` → territory centroid; the screen states the origin used |
| Fewer candidates than N | return what exists, state the shortfall and its cause |
| Clinics excluded for missing coordinates | returned as a count with a link to fix them — silently shrinking the candidate set is how a territory quietly stops being covered |
| No `facility_metric_snapshots` rows at all | `h = HEADROOM_UNKNOWN` for everyone; the component contributes nothing and the UI says potencial não medido |

### 4.8.1 Route quality, measured 2026-08-15

Straight-line path length of a generated day, against the shortest tour of the same clinics:

| rep | greedy only | with §4.5 step 5 | optimal |
|---|---|---|---|
| 2 Rio | 6.5 km | **6.5** | 6.5 |
| 3 São Paulo | 15.0 km | **15.0** | 15.0 |
| 4 Londrina | 4.3 km | **3.2** | 3.2 |
| 5 Brasília | 14.3 km | **9.2** | 9.2 |
| 6 São Luís | 7.8 km | **5.9** | 5.9 |

Interleaved with real bookings — a rep with commitments at 08:14 and 14:08 — the day walks
21.8 km greedily and **15.8 km** after re-ordering, against 15.3 km for an unconstrained tour that
ignores both fixed times. The 12.7 km forced by the two bookings alone means five extra visits cost
**0.6 km each**.

⚠️ **All of this is straight-line × 1.35 at a flat 28 km/h.** It says the *ordering* is sound; it
says nothing about real drive times. A 2 km straight line across a river or a one-way system is not
2 km, and São Paulo at 17:00 is not 28 km/h. Only the Matrix (P2) settles that, and until it lands
every duration on screen is labelled `estimado`.

### 4.9 Measured against the production clone, 2026-08-14

Run read-only against the `lane-b` clone (1 442 profiles, 1 131 orders — the production order count
quoted in spec 0013 §4.3, so the clone is representative).

**The book is 94 % prospects.**

| stage | profiles | % |
|---|---|---|
| `NEVER_PURCHASED` | 1 353 | 93.8 |
| `INACTIVE` | 43 | 3.0 |
| `PURCHASE_WINDOW` | 22 | 1.5 |
| `OUTSIDE_WINDOW` | 20 | 1.4 |
| `CHURN` | 4 | 0.3 |

`facility_metric_snapshots` holds **zero rows**. `purchase_interval_source` is `DEFAULT` for 1 368
profiles — only **74** have enough order history to compute a real interval (avg 99 days, avg
sample 6).

Consequences, all of which changed this spec:

1. **Timing and headroom rank almost nothing today** (§4.2 weights note).
2. **The bucket quotas were backwards** (§4.3).
3. **Capacity became the primary component**, not an enrichment.

**Orthopaedist headcount predicts purchasing.** `occupation_cnes_id = '225270'`, counted per
facility, against whether the profile has ever purchased:

| orthopaedists | clinics | buyers | % buyers |
|---|---|---|---|
| 0 | 270 | 10 | 3.7 |
| 1 | 773 | 28 | 3.6 |
| 2–4 | 230 | 11 | 4.8 |
| **5–9** | 81 | 17 | **21.0** |
| **10+** | 88 | 23 | **26.1** |

Buyers average **9.51** orthopaedists; never-purchased average **2.47**.

⚠️ This is predictive, not causal — large facilities buy more of everything, and headcount is
partly a size proxy. For *ranking* that is sufficient. It is not a basis for any claim about why a
clinic buys.

**Headcount alone is not enough — unit type is the other half.** Conversion by CNES unit type:

| unit type | clinics | buyers | % |
|---|---|---|---|
| Clínica/Centro de Especialidade | 570 | 55 | **9.6** |
| Policlínica | 180 | 9 | 5.0 |
| Hospital Geral | 141 | 5 | 3.5 |
| Consultório Isolado | 504 | 17 | 3.4 |

**91 % of our 89 buyers are outpatient private practice** — clínica, consultório or policlínica.
Five are general hospitals.

Ranked on headcount alone the top untapped clinic in the book is **ITO AM** (Instituto de
Traumato-Ortopedia do Amazonas, Manaus) — 131 orthopaedists, and a *Cooperativa ou Empresa de
Cessão de Trabalhadores na Saúde*. Staffing cooperatives and general hospitals aggregate surgeon
*registrations* without being purchasing entities, and they are **38 % of the raw ≥5 list**. The
signal that looked strongest was partly measuring the wrong thing.

This is what a rep would have said in ten minutes, and it is why §4.2 gained the fit component.

**The list, qualified** — outpatient unit types, ≥5 orthopaedists, never purchased:
**75 prospects** across five reps (24 / 20 / 15 / 9 / 7). Headed by Instituto Cohen, Ortocity,
CEOT, Ortovida Norte, Hospital Ortopédico, Cortrel, COT, Inão da Amazônia Ocidental and Vita
Clínicas. Every name reads as an orthopaedic practice, which the unfiltered list did not.

**`interactions` and `visits` hold zero rows.** Nothing has ever been recorded as visited. This is
what §4.3.1 exists to handle, and it means the neglect component ships as a constant.

**Two risks retired.** Every one of the 1 442 facilities has a `location`, and every one joins to
`registry.facilities` on `cnes_code` — so the §4.8 "excluded, no coordinates" path and any worry
about registry join coverage are, on today's data, empty. Keep both; they cost nothing and the next
import will not be so clean.

**Scale is small.** Five reps, 145–447 clinics each (avg 288), one live vertical (`ORTOPEDIA`). A
K=20 shortlist off ~288 candidates is trivial, and Mapbox cost is a rounding error at this size.

---

## 5. Data model

New tables in `public`. Drizzle schema in `packages/database/src/schema/public/roteiros.ts`.

```
roteiros
  id                       bigint pk
  user_id                  bigint  → users            (the agent the roteiro is for)
  created_by_user_id       bigint  → users            (rep themselves, or a manager proposing)
  vertical_id              bigint  → business_verticals
  scope_date               date                        (the day this roteiro plans)
  week_group_id            uuid null                   (ties the 5 days of a weekly generation)
  origin                   geometry(Point,4326)
  origin_source            enum GPS | BASE | TERRITORY_CENTROID | ANCHOR
  status                   enum DRAFT | CONFIRMED | DISCARDED | SUPERSEDED
  params_snapshot          jsonb  not null             (§5.1)
  travel_source            enum MAPBOX | ESTIMATED
  generated_at             timestamptz
  confirmed_at             timestamptz
  version                  integer                     (optimistic concurrency, as calendar does)
  unique (user_id, scope_date) where status in (DRAFT, CONFIRMED)

roteiro_stops
  roteiro_id               bigint  → roteiros (cascade)
  position                 smallint                    (0-based, contiguous)
  facility_vertical_profile_id  bigint → facility_vertical_profiles
  bucket                   enum MANTER | RECUPERAR | PROSPECTAR
  modality                 interaction_modality        (reuses the existing enum)
  modality_source          enum SUGGESTED | REP_OVERRIDE
  merit_score              numeric(6,5)
  score_breakdown          jsonb  not null             (§5.2)
  travel_seconds_from_prev integer null                (null for position 0 and for REMOTE)
  service_minutes          smallint
  planned_starts_at        timestamptz
  planned_ends_at          timestamptz
  source                   enum SUGGESTED | SUBSTITUTED | MANUAL | ANCHOR
  calendar_id              bigint null → calendar      (set on confirm)
  interaction_id           bigint null → interactions  (set on confirm)
  primary key (roteiro_id, position)
  unique (roteiro_id, facility_vertical_profile_id)

roteiro_stop_rejections
  id                       bigint pk
  roteiro_id               bigint  → roteiros
  position                 smallint
  rejected_profile_id      bigint  → facility_vertical_profiles
  replaced_by_profile_id   bigint null → facility_vertical_profiles
  reason                   enum MUITO_LONGE | JA_VISITEI | NAO_E_MEU_CLIENTE
                              | FECHADA | SEM_INTERESSE | OUTRO   (nullable)
  reason_note              text null
  created_at               timestamptz

roteiro_params                                   (one row per vertical; §6.3)
  vertical_id              bigint pk → business_verticals
  daily_limit              smallint  default 5   check between 1 and 12
  weights                  jsonb                 (w_t … w_q, must sum to 1 — checked)
  bucket_ratios            jsonb                 (MANTER/RECUPERAR/PROSPECTAR)
  cooldown_days            jsonb                 (per bucket)
  service_minutes          jsonb                 (per modality, per bucket override)
  unit_type_policy         jsonb                 (§4.2g — fit / eligible / forceRemote per type)
  reach_radius_km          integer   default 60  (§4.1, expands 60→120→250→500)
  tau_seconds              integer   default 900
  remote_threshold_seconds integer   default 2700
  coverage_horizon_days    jsonb                 (§4.3.1, per bucket)
  headroom_unknown         numeric   default 0.40
  workday_start / workday_end   time
  lunch_start / lunch_minutes   time / smallint
  max_generations_per_day  smallint  default 20
  updated_at / updated_by_user_id
```

### 5.1 `params_snapshot` is not redundant

Weights and quotas change. A stored score must stay explainable after they do, and a rep asking
"why was this suggested last Tuesday" must get last Tuesday's answer. Same discipline as spec 0013's
*store facts, derive views*: the roteiro carries the parameters it was built from.

### 5.2 `score_breakdown`

```jsonc
{
  "t": {"raw": 0.93, "weighted": 0.316, "r": 0.78, "daysToWindow": -12},
  "h": {"raw": 0.81, "weighted": 0.178, "theirsQty": 80, "share": 0.33, "surveyed": true},
  "n": {"raw": 1.00, "weighted": 0.160, "daysSinceInteraction": 62},
  "v": {"raw": 0.44, "weighted": 0.026, "oursQty": 40},
  "k": {"raw": 0.00, "weighted": 0.000, "stage": "PURCHASE_WINDOW"},
  "c": {"raw": 0.88, "weighted": 0.238, "orthopaedists": 24},
  "q": {"raw": 1.00, "weighted": 0.220, "unitType": "Clinica/Centro de Especialidade"}
}
```

Every number on a stop card is rendered from this object. **No reason on the card may exist that is
not in the breakdown**, and none may be produced by a language model (§12).

### 5.3 Changes to existing tables

```
users
  + base_location   geometry(Point,4326) null    -- the rep's starting point for future days
  + base_label      text null                     -- "Casa", "Escritório Campinas"

visits                                            -- currently id/user/facility/visited_at only
  + outcome         enum PEDIDO | PROMESSA | SEM_INTERESSE
                       | NAO_ENCONTROU | REAGENDAR   not null
  + outcome_note    text null
  + roteiro_stop    (roteiro_id, position) null      -- was this visit suggested, or self-directed?
```

`visits` today records that something happened and nothing about what. Every metric this feature
would be judged by needs the outcome. It is added here rather than deferred because a suggestion
engine that cannot be scored is a suggestion engine nobody will trust in three months.

### 5.4 Validated potential and confidence — P5

Adopted from the external review ([`design-review-2026-08-15.md`](./design-review-2026-08-15.md)
§3), and the one structural idea this spec did not have.

Everything the engine currently knows about an unvisited clinic is **inferred** from CNES — unit
type, orthopaedist count and ratio. `headroom_unknown = 0.40` is a single constant standing in for
*"nobody has ever looked"*, applied identically to a clinic we know nothing about and one a rep
walked into last week.

Split the two, per facility × vertical:

```
estimated_potential   derived from CNES; always available, never certain
potential_confidence  how much of it has been confirmed in the field
validated_potential   what a rep actually found, once they have been
validated_at / validated_by_user_id
```

The rep supplies the validated half in the **10–20 seconds after concluding a visit**, alongside
the §5.3 outcome — commercial relevance, whether the clinic uses the category at all, which
competitor holds it, rough opportunity size. Not a thirty-field form; a form that long gets
abandoned and then the data is worse than none.

Two things follow. The UI can say *"potencial alto, confiança 31 %"* instead of a bare number,
which is honest about an estimate built from a staff list. And **every first visit converts a CNES
inference into proprietary knowledge** — the one kind of data CNES and CFM cannot supply, and the
reason coverage is worth reserving a slot for at all.

Per vertical, never per facility: the same hospital is a different prospect in ortopedia and in
estética, which is the whole reason `facility_vertical_profiles` exists.

---

## 6. Configuration

### 6.1 Origin

**The rep's live GPS position, always.** There is no fallback (§4.1). Without a fix, the generation
fails with a message naming the permission to grant — a suggestion built from a guessed position is
worse than no suggestion, because its drive times look just as confident.

`origin_source` on the roteiro therefore carries only `GPS` or `ANCHOR`; `BASE` and
`TERRITORY_CENTROID` are removed along with `users.base_location`.

### 6.2 The limit

`roteiro_params.daily_limit`, default **5**, hard-capped at 12 by a check constraint. The API
accepts a per-request `limit ≤ daily_limit`; it may lower the ceiling, never raise it.

### 6.3 Who tunes what

| Setting | Who |
|---|---|
| weights, τ, bucket ratios, cooldowns, remote threshold | ADMIN / OPS, per vertical |
| daily limit | ADMIN / OPS, per vertical |
| workday window, lunch, base location | the rep, on their own profile |
| per-request limit (≤ ceiling), date, linha, anchors | the rep, per generation |

No per-rep weights in v1. Two reps disagreeing about weights is a conversation, not a schema.

---

## 7. API

New module `apps/api/src/modules/roteiro/`, following the standard layout
(`application/use-cases`, `infrastructure/routes|repositories`, `composition.ts`).
CASL subject **`ROTEIRO`**.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/roteiros/preview` | Generate without persisting a DRAFT — used by anchor exploration. Returns a full slate. |
| `POST` | `/roteiros` | Generate and persist a `DRAFT` for `(user, date)`. Supersedes an existing DRAFT for that key. |
| `GET` | `/roteiros?from&to&userId` | List (rep: own; manager: their reps). |
| `GET` | `/roteiros/:id` | Full slate with breakdowns, geometry and legs. |
| `PATCH` | `/roteiros/:id/stops/:position` | Substitute, change modality, or move. Returns the recomputed slate. |
| `DELETE` | `/roteiros/:id/stops/:position` | Remove a stop. |
| `POST` | `/roteiros/:id/stops` | Add a clinic explicitly. |
| `GET` | `/roteiros/:id/alternatives/:position` | Ranked replacements for that position. |
| `POST` | `/roteiros/:id/confirm` | Idempotent. Writes `calendar` + `interactions`. |
| `POST` | `/roteiros/:id/discard` | Status → `DISCARDED`, with an optional reason. |
| `GET`/`PUT` | `/roteiros/params/:verticalId` | Read/tune parameters (ADMIN/OPS). |

Every route: `.use(auth).use(requirePermission("<action>", "ROTEIRO", { resourceIdParam: "id" }))`
where a resource id exists. Use-cases receive `ScopeContext` and enforce it — no exceptions
(`AGENTS.md` § authorization invariants).

### 7.1 Generation request

```jsonc
{
  "verticalId": 3,
  "mode": "DAY",                      // DAY only in v1; WEEK deferred (§4.6)
  "date": "2026-08-15",
  "limit": 5,
  "origin": {"lat": -22.90, "lng": -47.06, "source": "GPS"},
  "anchors": [
    {"facilityId": 8812, "startsAt": "2026-08-15T13:00:00-03:00", "durationMinutes": 45}
  ],
  "modalityPreference": "AUTO",       // AUTO | IN_PERSON_ONLY | REMOTE_ONLY
  "buckets": null                     // null = params default; else override ratios
}
```

### 7.2 Generation response (shape)

```jsonc
{
  "id": 4471,
  "status": "DRAFT",
  "scopeDate": "2026-08-15",
  "origin": {"lat": -22.90, "lng": -47.06, "source": "GPS"},
  "travelSource": "MAPBOX",
  "totals": {"stops": 5, "driveSeconds": 4980, "serviceMinutes": 195, "endsAt": "..."},
  "stops": [ /* position, facility, bucket, modality, plannedStartsAt, travelSecondsFromPrev,
                meritScore, scoreBreakdown, reasons[] */ ],
  "legs": [ {"fromPosition": null, "toPosition": 0, "seconds": 720,
             "geometry": "<polyline6>"} ],
  "notices": [
    {"code": "QUOTA_UNFILLED", "bucket": "PROSPECTAR",
     "message": "Nenhuma clínica sem compras elegível — 1 vaga foi para Manter."},
    {"code": "EXCLUDED_NO_COORDINATES", "count": 3}
  ]
}
```

`notices` is not decoration. It is the mechanism by which this feature refuses to convert a
failure into silence.

### 7.3 Confirm

One transaction per roteiro:

1. Re-validate every planned slot against `conflict.service.ts`. **If the rep's calendar changed
   since generation, return `409` with the conflicts** — do not silently shift times.
2. Create one `calendar` row (`kind = INTERACTION`, `recurrence = NONE`) and one `interactions`
   row per stop, `modality` from the stop, `agent_user_id = roteiro.user_id`.
3. Write `calendar_id` / `interaction_id` back onto each stop; roteiro → `CONFIRMED`.
4. Idempotent through `calendar_command_receipts` (existing pattern), keyed
   `roteiro:{id}:confirm:{version}`.

A manager may generate a `DRAFT` for a rep but **may not confirm it** — `interactions` lifecycle is
already owner-only (`assertOwner`, `interaction.use-cases.ts:40`) and this spec does not weaken it.
Manager proposes; rep accepts.

### 7.4 Mapbox cost control

- **One** Matrix call per generation, ≤ 25 coordinates.
- Clinic↔clinic durations are effectively static. Cache in Redis keyed on the ordered pair of
  6-decimal-rounded coordinates, TTL 30 days. Only origin legs are fetched fresh.
- `max_generations_per_day` per rep (default 20), enforced and surfaced.
- The §4.1 reachability filter also caps Matrix cost: candidates are bounded by radius before the
  shortlist, so a spread book cannot produce a wider matrix than a compact one.
- Route geometry for the map: one `GET /maps/directions` call with `overview=simplified`,
  `geometries=polyline6`, only after the slate settles — not on every substitution
  (substitutions recompute times from the cached matrix; the drawn line refreshes on demand).

---

## 8. Mobile UX

New feature `apps/mobile/lib/features/roteiro/`. Entry points: a card at the top of the Agenda for
today, and a bottom-nav/home action **"Roteiro do dia"**.

### 8.1 The screen

Three coordinated views over one slate — never three separate screens with separate state.

1. **Lista** (default). Ordered cards. Each card:
   - order badge `1 … 5`, clinic name, **bairro**
   - bucket chip (`Manter` / `Recuperar` / `Prospectar`) — colours reuse `PurchaseBucketFilter`
   - modality chip (`Presencial` / `Remoto`), tappable to flip
   - `08:30 – 09:15` planned window, and `+22 min de deslocamento` above it
   - **two or three reasons in the rep's words**, from `score_breakdown`:
     - *"Entra na janela de compra em 3 dias"*
     - *"Concorrente com 80 ampolas/mês aqui — nossa participação 33%"*
     - *"Sem visita há 62 dias"*
     - *"24 ortopedistas registrados aqui"*
     - *"Potencial não medido — vale levantar a concorrência"*
   - overflow: **Trocar** · **Remover** · **Ver clínica** · **Mudar para remoto**
2. **Mapa**. Numbered pins in visiting order, the driving polyline, origin marker, REMOTE stops
   listed in a strip below the map rather than pinned on it (they are not travelled to). Tapping a
   pin scrolls the list.
3. **Linha do tempo**. The day as a vertical timeline including existing commitments and travel
   blocks, so the rep sees the day is actually feasible.

Sticky footer: `5 paradas · 1h23 de deslocamento · termina 17:40` and **Confirmar roteiro**.

### 8.2 Generation sheet

Linha (if the rep has more than one) · Dia / Semana · limit stepper (≤ ceiling) · origin
(Minha localização / Base / escolher no mapa) · optional anchor picker
("Já vou visitar…") · modality preference. One primary button: **Gerar**.

### 8.3 Substitution

**Trocar** opens a sheet of five alternatives, each showing what it costs the day
(`+8 min`) and its own reasons, sorted by fit-at-this-position. Choosing one animates the list into
its new order. An optional reason chip row (`Muito longe` / `Já visitei` / `Não é meu cliente` /
`Fechada`) — skippable, never blocking.

### 8.4 Execution

Confirmed roteiro becomes the Agenda for that day. Each stop keeps a **Iniciar** action wired to
the existing `POST /interactions/:id/start`. On **Concluir**, an outcome sheet (§5.3) —
`Pedido` opens the order flow directly with the clinic prefilled.

### 8.5 Accessibility & states

WCAG 2.1 AA per `PRODUCT.md`. Bucket and modality must never be conveyed by colour alone — every
chip carries text. Empty state ("Nenhuma clínica elegível hoje") states the reason and offers the
filter that would change it. Estimated travel times are labelled, not silently rounded into
certainty.

---

## 9. Manager view (spec 0014 surface)

- Per rep: roteiros generated / confirmed / executed, and **aderência** (stops completed ÷ stops
  confirmed).
- **Conversão por balde** — of confirmed stops, how many ended `PEDIDO` within 14 days, split by
  `MANTER` / `RECUPERAR` / `PROSPECTAR`. This is the number that says whether the weights are right.
- Top substitution reasons, per rep and per territory — a rep rejecting half their slate as
  *"não é meu cliente"* is an assignment-data problem, not a preference.
- `FECHADA` rejections should raise a Não Conformidade (spec 0007) automatically. A closed clinic
  the algorithm keeps suggesting is a data defect with a repair path already built.

---

## 10. Measurement, before any tuning

The following must exist from day one, because none of it is recoverable retroactively:

1. every generation: params snapshot, candidate count, notices, matrix source, latency
2. every stop: merit, breakdown, bucket, modality and its source
3. every substitution: what was rejected, for what, and why
4. every confirmation: which stops survived
5. every execution: outcome, and any order created within 14 days

Only then is the question "are the weights right" answerable. v1 changes weights by hand, in
`roteiro_params`, with the conversion number in front of the person changing them.

---

## 11. Offline

`PRODUCT.md` principle 5 requires the app to stay useful on unstable connectivity, and today
`apps/mobile` contains **no offline code at all**. This spec does not fix that generally. It fixes
it for the one screen where the rep is provably out of signal — in a car, between clinics:

- a **confirmed** roteiro is cached locally (slate JSON + a Mapbox static image of the route)
- it renders fully offline, including reasons and planned times
- `Iniciar` / `Concluir` / outcome are queued and replayed on reconnect, using the existing
  idempotency keys so a replay cannot double-write
- generation and substitution require connectivity and say so plainly

Anything wider is a separate spec.

---

## 12. On the AI assistant

The obvious idea is a chatbot the rep asks *"quais clínicas devo visitar amanhã perto de
Campinas?"*. **v1 does not ship it, and free-form chat over the CRM is out of scope permanently
until this section is amended.**

The reasoning, recorded so it is not relitigated by vibes:

- The question the chatbot would answer is the exact question the deterministic engine already
  answers — better, faster, auditably, and with numbers that came from the database.
- A rep acting in the field on a hallucinated share figure is worse than the feature not existing.
  It would poison trust in every number AtlasMed shows, including the correct ones.
- "The model said so" is not a reason a stop card can display, and §5.2 requires every reason to
  trace to a stored component.

Three grounded uses **are** worth building, in this order:

**Phase 1 — "Por quê?" (ships with v1, no model involved).** Expanding a stop shows the full
`score_breakdown` rendered as sentences from a template. Deterministic, testable, and it is what
reps actually mean when they ask the chatbot a question.

**Phase 2 — natural language as a form filler (post-v1).** The rep types
*"só clínicas que nunca compraram, perto de Sorocaba, quinta-feira"*. An LLM's **only** output is a
`RoteiroParams` JSON object, validated against the same schema the sheet produces. It is rejected if
it does not validate. It never states a fact, never produces a number, never names a clinic. The
deterministic engine then produces the slate, and every figure on screen still comes from Postgres.
This is safe because the model's entire blast radius is a filter the rep can see and undo.

**Phase 3 — pre-visit briefing (later).** For one clinic, a model summarises *retrieved* rows —
last orders, notes, open não conformidades, share, the surgeons attached — into four bullets, each
carrying a link to the row it came from. Read-only, single clinic, retrieval-grounded, and every
claim clickable back to its source. If a bullet cannot be linked, it is not shown.

The rule across all three: **the model may choose what to look at and how to phrase it. It may
never be the source of a number.**

---

## 13. Rollout

| Phase | Contents | Shippable alone |
|---|---|---|
| **P1** | Tables, params, merit scoring in SQL, **gain-based selection on haversine estimates**, `POST /roteiros`, list view, no map, no Matrix | yes — already better than today |
| **P2** | Matrix integration (swaps the cost source under §4.5, nothing else changes), 2-opt, map view, timeline, confirm → calendar | yes |
| **P3** | Substitution, alternatives, rejection reasons, modality override | yes |
| **P4** | Anchor mode ("já vou visitar X — o que mais?") | yes |
| **P5** | Outcome capture on `visits`, **validated potential + confidence** (§5.4), manager metrics, aderência/conversão | yes |
| **P6** | Offline cache for confirmed roteiros | yes |
| **P7** | AI phase 2 (form filler), then phase 3 (briefing) | separate spec |

P1 is deliberately useful without Mapbox: a ranked, explained list of five clinics with reasons is
already the thing that does not exist today.

> **§4.5's selection moved into P1**, because it turned out to need *a* cost model rather than
> Mapbox specifically, and the haversine estimator is one. Measured against the real book, choosing
> the top five by merit and only then ordering them produced 405 minutes of driving across the five
> reps; choosing by merit-per-hour produced **152**. Rep 4's slate went from four clinics inside
> 2 km plus one at 41 km — an ~80-minute round trip for a single stop — to five inside 3 km, and
> the merit of the clinics chosen barely moved (top stop unchanged at 0.739). P2 swaps the Matrix in
> underneath and changes nothing else.

---

## 14. Acceptance criteria

1. A rep with assigned clinics gets **exactly `limit`** stops, or fewer **with a stated reason**.
2. Every stop shows at least one reason, and every reason traces to a field in `score_breakdown`.
3. A slate containing no `PROSPECTAR` stop **says so and says why**. It is never silently absent.
4. Two clinics both in `PURCHASE_WINDOW`, one 2 days in and one 40 days in, receive **different**
   timing scores.
5. A clinic with **no** `facility_metric_snapshots` row is still reachable, and its card says
   *potencial não medido*.
6. A clinic with no coordinates is excluded **and counted** in `notices`.
7. Mapbox unavailable → the slate still generates, times are labelled **estimado**, and
   `travelSource = ESTIMATED`.
8. Planned start times account for drive time: `stop[n].plannedStartsAt ≥ stop[n-1].plannedEndsAt +
   travelSecondsFromPrev`.
9. A `REMOTE` stop contributes **zero** travel seconds and does not appear on the route polyline.
10. Confirming writes one `calendar` + one `interactions` row per stop; confirming **twice** writes
    nothing more (idempotency receipt).
11. Confirming after the rep's calendar changed returns `409` with the conflicting occurrences —
    never a silently shifted time.
12. Substituting a stop returns a slate whose **times are recomputed**, and writes a
    `roteiro_stop_rejections` row.
13. A manager can generate a DRAFT for their rep and **cannot** confirm it.
14. A rep cannot see, generate for, or confirm a roteiro for a clinic outside their scope.
15. One generation issues **at most one** Mapbox Matrix call.
16. A confirmed roteiro renders fully with the device offline (P6).
17. `daily_limit` is changed in `roteiro_params` and the next generation honours it, with no deploy.

---

## 15. Decisions and open questions

### 15.1 Decided 2026-08-14

**One roteiro per linha.** `roteiros.vertical_id` is `NOT NULL` and the rep chooses the linha when
generating. Merit percentiles are computed **within** the linha, so headroom and account value —
both per `facility_vertical_profile` — compare like with like. Accepted cost: a rep holding two
linhas may be routed to the same clinic twice in a week. The §4.1 cooldown is keyed on the profile,
not the facility, so it will not suppress the second visit. Revisit if that turns out to annoy
reps more than mixed ranking would distort the numbers.

**Reps set a base location.** `users.base_location` + `base_label` (§5.3), set on the profile
screen through the existing Mapbox search-box adapter. The territory centroid remains the fallback
for a rep who has not set one, and the response's `origin_source` always says which was used — a
silent centroid is exactly the quiet wrongness this decision exists to avoid. Onboarding must
prompt for it; a rep with no base and no GPS gets an actionable error, not a guess.

**Build the whole feature**, P1 → P6, in the §13 order. Each phase remains independently
shippable; the sequence is a delivery order, not a set of gates awaiting separate approval. AI work
(P7) stays a separate spec.

### 15.1b Decided 2026-08-15

**Day-to-day only. Weekly and trip planning are out** — *"Lets not think of the week yet. That
would be overcomplicating things."* §4.6 is deferred; §16.1 records what the spread books still
need.

**Suggestions must be reachable.** *"We should suggest clinics closeby or at least something
doable."* Implemented as the §4.1 reachability filter with a self-expanding radius, which also
fixes a genuine defect: merit-first shortlisting could hand a rep in Belém twenty excellent clinics
in Manaus.

**The book is curated** — the 1 442 assignments are deliberate, despite arriving in one bulk write
on 2026-08-09. Coverage therefore walks the whole book (§4.3.1) with no qualification gate, and a
one-surgeon consultório still gets its turn.

**Unit-type handling is configurable**, not hard-coded — *"maybe we should be able to set it up and
edit this somehow."* `roteiro_params.unit_type_policy`, three levers per type (§4.2g).

**Five stops a day is right**, with 45-minute visits. Confirmed against how reps actually work,
which is the only place that number could have come from — `interactions` and `visits` are empty,
so the system knows nothing about it.

### 15.2 Defaults taken without asking

Change any of these by saying so — none is load-bearing, all live in `roteiro_params`.

| Setting | Default | Reasoning |
|---|---|---|
| Service duration | **45 min** `IN_PERSON`, **15 min** `REMOTE`, each snapped up to a 30-minute calendar slot → **60 / 30** | Per-bucket durations are a guess until §10 has real spans to fit against. The snap is not a guess: `calendar.validateEventData` requires a positive multiple of 30, so a roteiro planning 45 would write 60 into the rep's calendar at confirm — the silent shift §7.3 forbids, discovered only after they approved it. Planning in the calendar's own unit keeps the approved times and the booked times identical. Cost: a day holds slightly fewer stops than the raw durations suggest. The alternative is relaxing the calendar's 30-minute rule, which every other interaction already relies on. |
| Workday | **08:00–18:00**, per rep | Per rep, on their profile, per §6.3. |
| Lunch | **12:00**, 60 min | A block the router must not schedule through. |
| Cooldowns | `MANTER` 14 · `RECUPERAR` 21 · `PROSPECTAR` 30 days | §4.1. |
| Cooldown trigger | only a **`COMPLETED`** interaction resets it | A confirmed-but-unexecuted stop must not suppress the clinic — otherwise a rep who never goes stops being told to go. |
| Manager DRAFT | appears in-app, **no push** in v1 | Push exists (Firebase) but an unsolicited plan arriving on a rep's phone is a workflow decision, not a technical one. Revisit with reps. |
| Weekly cadence | **rolling 7 days**, regenerated on demand | More useful than a frozen Monday plan. Costs more Matrix calls; the §7.4 cache absorbs it. |

### 15.1c Decided 2026-08-15 — external design review

Full assessment in [`design-review-2026-08-15.md`](./design-review-2026-08-15.md).

**Adopted:** the professional *ratio* alongside the count (§4.2f, measured 32 % vs 11 % inside the
band the count treats as equal); assignment age as the coverage tie-break (§4.3.1); validated
potential and confidence at P5 (§5.4); "maintenance vs exploration by território maturity" as the
vocabulary for tuning the §4.3 quotas.

**Declined:** sales-trend and open-opportunity weights — 35 % of the reviewed formula, and neither
computable (74 profiles have enough order history; there is no opportunity entity at all).
Facility-type priors by estimate, since measurement contradicts them — the two types it separates
by 2× convert at 3.5 % and 3.4 %. A flat never-visited bonus, which is outbiddable where a reserved
slot is not, and a no-op today besides. Multiplicative modifiers on an additive score, which reach
×2.27 and leave the clamp doing the ranking. A 0–100 score on screen, which implies precision five
constant components cannot support.

**Hospitals rank below clinics by commercial decision**, beyond what conversion alone justifies
(§4.2g).

### 15.2b Chains and branches — open commercial question, 2026-08-15

Two *Vita Clínicas Medicina Especializada* stops appeared in one generated day
and read as the same clinic twice. They are not: the book holds **eight**
branches of that chain across São Paulo — one CNPJ root (`11831222`), eight
filiais, from Ibirapuera (32 orthopaedists) to Morumbi (0) — and all eight
belong to the same rep. The engine picked the two largest, which is correct.

The **presentation** was not. Both cards said only "Sao Paulo", so nothing on
screen distinguished them. The stop card now leads with the bairro
(`registry.facilities.neighborhood`). This is not cosmetic: **61 name-groups in
the book cover 149 facilities**, about 10 % of it, so a rep meets this regularly.

**Still open, and it is a commercial question rather than a technical one:** is a
chain one buying decision or eight? If purchasing is centralised at the group,
two branches in a single day is duplicated effort and the engine should cap
stops per CNPJ root — `substring(tax_id_cnpj, 1, 8)` is a clean group key and
`registry.facilities.tax_id_cnpj` already carries it. If each branch orders
independently, the current behaviour is right and no cap should exist.

Nothing is implemented either way until this is answered. Guessing would encode
a purchasing model nobody has confirmed.

### 15.3 Still open

1. **Ortho CBO prefix** — which `CO_CBO` values count as orthopaedics for the §0.1 capacity signal
   ([`data-sources.md`](./data-sources.md)). Must be *measured* against the dump, not assumed.
2. **`PROSPECTAR` eligibility floor** — should a never-purchased clinic with zero orthopaedists and
   no ortho habilitação be a candidate at all, or filtered out before scoring? Answerable only once
   Tier-1 CNES data lands.
3. **Whether reps want the same clinic twice in a week** across two linhas (see 15.1).

---

## 16. Deferred

### 16.1 Trip planning for geographically spread books

Measured spread per rep, straight-line from their own book's centroid:

| rep | clinics | states | cities | max km |
|---|---|---|---|---|
| 2 | 146 | 1 (RJ) | 1 | 18 |
| 3 | 145 | 1 (SP) | 9 | 222 |
| 4 | 447 | 1 (PR) | 40 | 277 |
| 5 | 259 | 2 (DF, TO) | 10 | 1 004 |
| 6 | 445 | 7 (PA, MA, RO, AM, AC, RR…) | 72 | **2 080** |

Rep 6's book is not a territory, it is a set of city clusters — São Luís 58, Manaus 43, Belém 42,
Porto Velho 37, Rio Branco 29, Boa Vista 16. For that rep the unit of planning is a **trip**, not a
day, and the question the product cannot yet answer is *which city do I fly to next*.

The §4.1 reachability filter makes the daily engine **correct** for these reps — it will suggest
Belém clinics while they are in Belém, and say how far it had to reach. It does not make the
product complete for them.

When this is picked up, the shape is already known: k-medoids over the rep's book by city, each
cluster scored by summed merit and by coverage debt, and the winner planned as N consecutive days
with a fixed origin. It is the deferred weekly engine with the day replaced by a trip.

## 17. Risks

| Risk | Mitigation |
|---|---|
| Weights are guesses and the first slates look wrong | §10 measures from day one; τ and weights are data, not code; P1 ships without routing so the ranking can be judged in isolation |
| `purchase_interval_days` is distorted at multi-surgeon clinics (`purchase-recurrence.ts:284`) | documented on the card; do not present it as a buyer's habit; revisit if `orders.person_id` is ever populated |
| Mapbox spend grows with adoption | one call per generation, 30-day pair cache, per-rep daily cap, all in §7.4 |
| Reps ignore it and keep planning by hand | aderência is measured per rep in §9; low adoption is visible, not guessed at |
| The engine keeps suggesting a clinic that closed | `FECHADA` rejection raises a Não Conformidade (§9) |
| Cadastro/assignment data is wrong, so slates are wrong | substitution reasons expose exactly this, per territory (§9) |
