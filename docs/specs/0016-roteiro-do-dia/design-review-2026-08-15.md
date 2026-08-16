# Spec 0016 — External design review, 2026-08-15

An outside proposal for the recommendation engine was reviewed against the implemented P1 and
against production data. This records what it got right, what it got wrong **for this codebase**,
and what was adopted — so the same debate is not had twice from memory.

Its central architectural claim is one this spec already holds: **ranking decides what matters,
routing decides what is sensible today, and the two must stay separate.** Also convergent:
per-vertical configurable weights, stored explainable signals, coverage as a first-class goal,
rules before machine learning, and outcome capture as the path to learning later. Independent
agreement on all of that is worth recording.

The disagreements are the useful part.

---

## 1. Adopted — professional *ratio*, not just count

**The review is right and the implemented capacity component was too blunt.** Its example: a
hospital with 120 physicians of whom 3 are orthopaedists is not the same prospect as a clinic with
14 of whom 12 are, even though a raw count ranks the hospital higher.

Measured on the production clone:

| orthopaedists as a share of all staff | clinics | buyers | % |
|---|---|---|---|
| <15 % | 291 | 8 | 2.7 |
| 15–40 % | 177 | 6 | 3.4 |
| 40–70 % | 156 | 10 | 6.4 |
| **70 %+** | 602 | 56 | **9.3** |

And, critically, **held inside the band the capacity component already treats as equal**
(≥5 orthopaedists):

| | clinics | buyers | % |
|---|---|---|---|
| high ratio (≥40 %) | 99 | 32 | **32.3** |
| low ratio (<40 %) | 70 | 8 | **11.4** |

Nearly 3× separation among clinics the engine currently cannot tell apart. §4.2f gains the ratio.

This is also the *general* form of a defect already patched narrowly: ITO AM — a staffing
cooperative with 131 registered surgeons — topped the raw-count ranking and was demoted by
unit-type fit. Ratio catches that class of facility without needing the type to be enumerated.

## 2. Adopted — assignment age in the coverage rotation

A clinic assigned 180 days ago and never visited is more overdue than one assigned last week. The
rotation currently orders on `last_suggested_at` alone, which cannot see the difference.
`facility_vertical_rep_assignments.started_at` already exists, so this is a sort key, not a
migration.

⚠️ **No signal today.** All 1 442 assignments were written in one bulk operation on 2026-08-09, so
`days_since_assignment` is currently uniform. Build it anyway — it starts working the first time a
book changes hands, and it cannot be backfilled later.

## 3. Adopted, for P5 — confidence, and validated vs inferred potential

The review's strongest long-term idea, and the one this spec did not have:

- an **estimated** potential (derived from CNES: type, professionals, specialties) carries a
  **confidence**, and
- a **validated** potential replaces it once a rep has actually been, captured in 10–20 seconds
  after a visit: commercial relevance, uses the category, current competitor, opportunity level.

`headroom_unknown = 0.40` is a crude one-off of exactly this — a single constant standing in for
"we have not measured this clinic". Making confidence explicit lets the UI say *"potencial alto,
confiança 31 %"*, which is honest in a way a bare score is not, and it turns every first visit into
proprietary data that CNES and CFM cannot supply.

Lands with P5, where outcome capture already lives (§5.3). The review's proposed
`facility_vertical_intelligence` shape is close to right; it must stay **per vertical**, since the
same hospital is a different prospect in ortopedia and in estética.

## 4. Adopted as vocabulary — maintenance vs exploration by territory maturity

Mechanically identical to the §4.3 bucket quotas, but a better way to talk about tuning them: a new
território might run 30 % maintenance / 70 % exploration, a mature one 80 / 20. Recorded here so
the ratios get discussed in those terms.

---

## 5. Declined — sales-trend and opportunity signals

The review's V1 formula allocates **20 % to sales signals and 15 % to open opportunities**. Neither
is buildable:

- **Sales trend.** 1 131 orders exist across 1 442 profiles, and only **74** have enough order
  history to compute an interval at all (§4.9). "Purchases down 55 % versus baseline" is
  computable for a few dozen clinics, not a book.
- **Opportunities.** There is no opportunity entity in this codebase — no pipeline, no stages, no
  probability, no expected value. `opportunity_score = value × probability × urgency` requires
  building a pipeline CRM first, which is a larger project than this one.

**35 % of the proposed score cannot be computed.** The review's own second half concedes this and
pivots to coverage-plus-estimated-potential; the two halves do not agree with each other, and the
second is the correct one for today.

## 6. Declined — guessed facility-type priors

The review proposes priors including Hospital Geral **75** and Consultório Isolado **35** — a
better-than-2× gap. Measured conversion:

| unit type | clinics | buyers | % |
|---|---|---|---|
| Clínica/Centro de Especialidade | 570 | 55 | 9.6 |
| Policlínica | 180 | 9 | 5.0 |
| Hospital Geral | 141 | 5 | **3.5** |
| Consultório Isolado | 504 | 17 | **3.4** |

The two it separates by 2× are **indistinguishable** in the data. Shipping those numbers would
encode a difference that does not exist. §4.2g's values stay measured, and stay in
`roteiro_params` where they can be re-measured.

## 7. Declined — a flat "+25 never visited" bonus

Two problems.

A bonus is **outbid by a large enough account**; a reserved slot is not. §4.3.1 reserves a slot
precisely so coverage cannot lose an auction it was never meant to enter.

And it is a **no-op on today's data**: `interactions` and `visits` both hold zero rows, so every
clinic in the book is never-visited and a uniform bonus cancels out entirely. The review's
`coverage_score` ladder (100 / 90 / 75 / 50 / 25 / 0) collapses the same way.

## 8. Declined — multiplicative modifiers on an additive score

The review layers modifiers (× 0.20 recently visited, × 1.25 sales fell, × 1.30 became inactive,
× 1.40 critical issue) onto a weighted sum, then clamps with `min(100)`.

Three stacking modifiers reach **× 2.27**, at which point the clamp is doing the ranking and the
weights have stopped meaning anything. A weighted sum with **Σw = 1**, enforced by a database
check, is duller and stays interpretable — which matters because every stop card is rendered from
those contributions.

## 9. Declined — the 0–100 score as a display

Reps will read the second digit. A clinic at 84 is not meaningfully above one at 81, and showing
the number invites a precision the inputs do not support — five of seven components are constants
today (§4.2). The review's own best instinct is that the **reasons** earn trust; the stop card
shows those and no score.

## 10. Not applicable — the eligibility example

The review warns that an orthopaedics rep must not be recommended a dermatology clinic merely
because it carries an orthopaedics profile. Correct in principle, and structurally impossible here:
assignment is per `facility_vertical_profile`, so that profile carries its own rep assignment
(spec 0009). The candidate set joins that assignment directly (§4.1).

---

## 11. Unit type — a stated commercial preference, 2026-08-15

> *"I don't want to recommend hospitals as much as I recommend clinics."*

Already the mechanism, now sharpened. `roteiro_params.unit_type_policy` carries a `fit` per CNES
unit type (§4.2g), and the shipped values already rank general hospitals well below specialist
clinics — **more steeply than the measured conversion alone would justify** (0.20 vs 1.00, a 5×
penalty, against a measured 2.7× difference). That gap is deliberate and is now a recorded
commercial decision rather than an artefact:

- a hospital visit costs more of a rep's day (access, waiting, gatekeeping) than a clinic visit,
- purchasing is centralised and slower, and
- the review's own §4 logic applies — a general hospital's orthopaedists are a small share of a
  large staff, which the new ratio component (§1) now penalises independently.

`Hospital Geral` moves **0.20 → 0.15**. The two levers beyond `fit` remain available without a
deploy:

| want | set |
|---|---|
| hospitals ranked lower still | lower `fit` |
| hospitals never suggested at all | `eligible: false` — also drops them from the cobertura denominator |
| hospitals contacted by phone rather than driven to | `forceRemote: true` |

`Hospital Especializado` stays at 0.35 rather than following Hospital Geral down: an orthopaedic
specialty hospital is a different proposition, and the sample is too small to say more (2 clinics
at ≥5 orthopaedists, 1 buyer).

---

## Summary

| # | Item | Decision |
|---|---|---|
| 1 | Professional ratio | **Adopt now** — measured 32 % vs 11 % |
| 2 | Assignment age in coverage | **Adopt now** — no signal yet, cannot be backfilled |
| 3 | Confidence + validated potential | **Adopt P5**, with outcome capture |
| 4 | Maintenance/exploration vocabulary | **Adopt** as framing |
| 11 | Hospitals below clinics | **Adopt** — `Hospital Geral` 0.20 → 0.15 |
| 5 | Sales-trend / opportunity weights | Decline — no data, no entity |
| 6 | Guessed type priors | Decline — measured values disagree |
| 7 | Flat never-visited bonus | Decline — outbiddable, and a no-op today |
| 8 | Multiplicative modifiers | Decline — clamp would do the ranking |
| 9 | 0–100 score on screen | Decline — implies precision we lack |
| 10 | Vertical eligibility leak | Not applicable — spec 0009 prevents it |
