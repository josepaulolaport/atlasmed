# Spec 0014 — Desempenho & Equipe

**Status:** Implemented (2026-08-11)
**Depends on:** spec 0009 (ownership), spec 0010 (profile as commercial hub), spec 0013
(market metrics)

---

## 1. Context

`Desempenho` exists today (`apps/mobile/lib/features/dashboard/`) and is **rep-scoped only**.
There is no per-rep aggregation anywhere: no endpoint, no screen. For ADMIN it degrades to
`facilityIds = null` — an unbounded, cross-vertical national aggregate labelled
"Brasil · visão geral".

**The scope plumbing already exists and is unused.** `scope.analyticsFacilityIds`,
`analyticsEffectiveTerritoryIds` and `reportAssignedTerritoryIds` are all computed in
`scope-resolver.service.ts` and **consumed by nothing outside tests**. `managedUserIds` already
resolves a manager's reps. This spec is largely wiring, not new machinery.

Spec 0013 adds `facility_metric_snapshot`, which makes penetração aggregatable for the first
time — previously it was computed per request and could not be rolled up.

---

## 2. Screens

```
Desempenho     one screen · viewer's scope · filters
Equipe         the roster
  → perfil     → "Ver desempenho" → the SAME Desempenho screen, scoped to that person
```

**No nested dashboard segments.** Drill-down goes through Equipe and the person's profile. One
screen, three entry points, three scopes.

| Role | Equipe shows | Desempenho scope |
|---|---|---|
| REP | — | own assigned clinics |
| MANAGER | their reps | clinics in their zones; or one rep, via that rep's profile |
| ADMIN | managers → drill into each manager's team | all; or one manager/rep, via profile |

The existing users page stays admin-only.

---

## 3. Scope & vertical

**Always exactly one vertical.** The user switches; verticals are never mixed. Data from two
linhas in one number is meaningless.

This also removes today's ADMIN special case — an admin picks a vertical like everyone else,
rather than receiving a cross-vertical aggregate.

**Denominators are profile-conscious and role-dependent:**

| Role | Denominator |
|---|---|
| REP | clinics **assigned** to them |
| MANAGER | clinics **in their zones** |

---

## 4. Metrics

Each metric is a **separate endpoint**, taking the same scope + filter parameters, independently
cacheable and independently able to fail. The screen renders skeletons and fills them as they
arrive.

**Not** one fat `/dashboard/summary` blocking on its slowest query — which is what exists today.

| Metric | Definition |
|---|---|
| **Clínicas atribuídas** | count of profiles in scope |
| **Cobertura** | `(active + inactive) ÷ denominator` — clinics that have **ever bought**. Buckets from `purchase_funnel_stage`: active = `PURCHASE_WINDOW`; inactive = `OUTSIDE_WINDOW`, `CHURN`; never-bought = `NEVER_PURCHASED`, `INACTIVE`, null |
| **Penetração média** | mean `share` across clinics in scope, **counting only clinics where it is calculated** — clinics with no data must not drag the average toward zero |
| **Pedidos semana / mês** | **count** of orders |
| **Taxa de cadastro completo** | `conformity_status = REGISTERED ÷ denominator` |
| **Clínicas não atribuídas** | manager only — clinics in their zones with no active rep. A geometry count (spec 0010 §1.4), needing no relevance data |
| Distribuição por bucket | the existing pie chart — retained |

**Conversão was considered and dropped** — the bucket pie chart already conveys it.

**Atividade / interações is excluded** until there is real visit data. The `visits`,
`interactions` and `calendar` modules exist, but nothing populates them meaningfully yet.

**Deactivated facilities are excluded from every count** (B4-2) — today
`drizzle-dashboard.repository.ts` joins `facilities` and never filters `deactivated_at`.

### 4.1 Per-metric breakdown
Every metric card drills into its **per-clinic breakdown**, and each clinic row links to the
clinic profile. Same shape at every level.

---

## 5. Filters

`unit_type` · `manager` · `rep` · `state` · `municipality`

- `state_id` / `municipality_id` are real FKs on `facilities` — available immediately.
- **`unit_type` depends on item 14.** There is no `/unit-types` endpoint and the DTO emits raw
  ids with no way to resolve names. That filter cannot ship before item 14.
- `manager` / `rep` filters are how a viewer narrows without leaving the screen — the reason
  nested dashboard segments are unnecessary.

Filters apply uniformly to every metric endpoint.

---

## 6. Equipe

Manager sees their reps; admin sees managers and drills into each manager's team. Each row
carries the person, their assigned clinics, their territories, and basic information.

**Sorting:** alphabetical by default; sortable ascending/descending **by any metric**.

**Revised 2026-08-12 — see §8.5.** The original rule was that the endpoint computes *only* the
active sort metric, and only that metric shows a value per person. Built and used, it made the
roster a single-column leaderboard: seeing anyone's clinics *and* their pedidos meant sorting
twice and holding the first answer in your head. Every row now carries clínicas, cobertura,
cadastro and pedidos at all times — one batched statement for the whole roster, not one request
per member — and sorting reorders the list rather than deciding what a row will tell you.

**Reps without an active patch** appear here (spec 0009 R8/D9). A rep with no patch has no
manager, appears on no team, and can hold no clinics — this roster is what makes that visible
instead of silent.

---

## 7. Acceptance criteria

1. Every metric loads on its own request; one slow metric never blocks the others.
2. Switching vertical re-scopes every metric; no view ever mixes two verticals.
3. A manager's denominator is clinics **in their zones**; a rep's is clinics **assigned**.
4. Penetração média ignores clinics with no calculated share, rather than counting them as zero.
5. Deactivated facilities appear in no count.
6. A manager opening a rep's profile and choosing "Ver desempenho" sees the same screen scoped
   to that rep.
7. Sorting Equipe by a metric shows that metric's value per person.
8. A rep with no patch appears in the reps-without-patch roster.

## 8. Defects closed

D-53 (deactivated facilities in counts). Consumes the previously-dead
`analyticsFacilityIds` / `analyticsEffectiveTerritoryIds` / `reportAssignedTerritoryIds`.

## 8.1 As built (2026-08-11)

Everything in §2–§6 ships, plus item 14, which §5 named as the blocker for the `unit_type`
filter. Three things are worth writing down because they are decisions the spec did not
make:

- **Penetração média is per metric, not one number.** §4 lists it as a single card, but a
  linha may define several metrics and a product carries one `metric_units` value per
  metric (spec 0013 §4.2) — so summing `ampolas_mes` and `prp` would be arithmetic on
  incompatible quantities. The endpoint returns one row per definition and the card renders
  one row each. The Equipe leaderboard sorts by the first definition, and says so.
- **The card reports `clinicsCounted` beside the mean.** §4 requires ignoring clinics with
  no calculable share; it does not say the user should be told how many that was. A mean
  over 3 of 200 clinics is a real number about very little, and the gap is the honest part.
- **Pedidos "semana" is the trailing seven days**, not a calendar week — there is no
  week-start convention in this product to inherit, and inventing one would make Monday's
  number collapse for reasons nobody asked about. "Mês" is the calendar month in
  `America/São_Paulo`, matching every other bucketed figure. Both counts apply ADR 0003
  eligibility (`APPROVED`/`INVOICED`, `SALE`/`CONSIGNMENT`); counting every row would count
  `DRAFT` and `REJECTED` orders as commercial activity.

~~**Penetração média renders empty, and will until spec 0013's P4 triggers land.**~~
**Superseded 2026-08-12 — the triggers landed** (PR #258). Rep edits recompute inline, order
writes enqueue a Temporal workflow, an hourly sweep reconciles and a nightly pass covers the
profiles nothing touched. The warning this section carried — that wiring one trigger without
the others would snapshot only the clinics with competitor data and drag the mean down — is
answered: all of them landed together, and the `no_other_brands` claim now decides whether a
clinic *has* a share at all rather than leaving 100% to be inferred from silence.

The number is still `—` in an environment where nothing has been written yet, which is
correct: it populates as orders are placed and reps record competitors.

### Rebased onto spec 0013 §4.6 (2026-08-12)

`facility_metric_snapshots` lost its `month`. One row per (clinic-linha, metric), no series,
so penetração média changed with it:

- **It averages the stored `share`; it no longer computes one.** `share` is null unless the
  market is genuinely known — a competitor figure exists, or a rep has claimed "nenhuma outra
  marca". Recomputing `ours ÷ total` here would call a clinic with orders and no competitor
  data **100%** and fold that into a manager's average: precisely the plausible wrong number
  spec 0013 §4.6 introduced the claim to prevent, arriving through the aggregate instead of
  the clinic screen.
- `AVG` and `COUNT` skip nulls, which *is* §4's "counting only clinics where it is
  calculated". `COALESCE(share, 0)` must never appear here — it averages "we know nothing" in
  as "we sell nothing".
- The trailing-month window is gone from this endpoint, and with it the injected clock. The
  90-day window still exists but lives in the recompute that writes the row, which is where
  it belongs: a reader cannot derive a day window from month facts.

## 8.2 Found in review (2026-08-11)

Four defects, one of them fatal to an endpoint, plus two gaps that are the
user's call rather than a bug.

- **`GET /dashboard/metrics/orders` was a 500 on every call.** `countOrders`
  bound two `Date` values inside a raw `sql` template, where there is no column
  for the driver to infer an encoder from, so postgres-js rejected the statement
  at Bind time with `ERR_INVALID_ARG_TYPE`. The query-shape test passed
  throughout — the SQL it emitted was correct; it was never sent. Fixed by
  mapping through `orders.orderedAt.mapToDriverValue`, and covered by
  `dashboard-queries.db.test.ts`, which now *executes* every dashboard query
  rather than inspecting it. That file is the real lesson: a repository whose
  only test is `toSQL()` has no proof it runs.
- **The subject leaked across screens.** The subject lived in a global
  `StateProvider` that the pushed subject screen wrote to on mount, and nothing
  reset on pop — so a manager who opened a rep's Desempenho and went back kept
  seeing that rep's numbers on their own tab, under the heading "Desempenho".
  The scope is now a `Provider.family` keyed by the subject, which makes the
  leak unrepresentable rather than remembered.
- **OPS could list the roster but not sort it.** `ListTeamUseCase` admits OPS;
  `resolveSubject` refused it, and every leaderboard row resolves its member as
  a subject — so sorting Equipe by any metric 403'd the whole request. OPS now
  resolves subjects; it already reads every clinic in its verticals.
- **Two smaller ones:** the territory card read territories without
  `is_active`, so it could draw a retired zone beside metrics that had stopped
  counting it; and the `unassigned-clinics` breakdown checked the scope before
  the role, so a REP whose scope resolved to nothing got an empty list where the
  card gave them a 403 — and an empty list reads as the reassuring answer.

**Both gaps this review opened have since been closed:**

- **An admin's Equipe was empty**, because no user held a `manager_zone` — the
  snapshot had 2 ADMINs and 5 REPs and no MANAGER, so §2's "admin → managers →
  their reps" had no first step. Migration `0096` creates the three managers and
  assigns them the five zones. It also repairs the geometry underneath: 151 of
  1443 profiles (10.5%) recorded a `manager_zone_id` whose polygon did not
  contain the clinic, so the assignment would have handed a manager a book that
  the first recompute took away.
- **All five filters now ship**, multi-select, searchable, and progressive.

## 8.3 Filters as built (spec 0014 §5)

Each facet's options are computed over the scoped clinic set with **every filter
applied except its own**. That one rule produces the progressive behaviour
without special-casing the hierarchy: choose São Paulo and the município drawer
becomes São Paulo's municipalities that hold clinics you can see; choose a
gestor and the representante drawer becomes their reps; choose a representante
and the gestor drawer narrows in turn. A facet must omit its *own* selection or
the first choice traps you in it — picking São Paulo would collapse the estado
list to São Paulo and leave no way to add Rio.

Three decisions the spec did not make:

- **Options are what exists in scope, not what exists in Brazil.** There was no
  states or municipalities endpoint, and adding one would have been the wrong
  answer: a manager whose zones are Paraná and Norte has no business being
  offered Bahia, and an option that can only ever return zero clinics is a dead
  end discovered by tapping it.
- **Selection cascades, not just options.** Picking the *city* of Rio selects
  the state of Rio with it; clearing that state drops the cities inside it.
  Without the first, the two drawers give contradictory answers to one question;
  without the second, the screen keeps filtering by a município the user
  believes they cleared. A child survives when *another* parent is still
  selected — irrelevant for geography, but a rep may report to two managers.
- **`unit_type` is outside the faceting in both directions.** Its list is the
  whole catalogue whatever else is chosen, and choosing one narrows nothing.
  Types only; subtypes would need a filter no metric endpoint has.

Both the singular (`stateId`) and plural (`stateIds`) query forms are accepted
and merged, because installed mobile builds still send the singular and dropping
it would make every one of them filter by nothing at all, silently.

**Route tests: built after review.** They were the follow-up this section named, and
the orders 500 (§8.2) is the argument for why they could not stay a follow-up — the
whole failure lived in the one layer nothing exercised. `dashboard.route.ts` and
`team.route.ts` now take injected use cases with `auth` as the default plugin, the
shape `orders.route.ts` established, and `dashboard-http.integration.test.ts` mounts
them: every metric endpoint answers, every filter survives into the request, an unknown
metric key and an oversized page are refused at the route layer, a domain refusal
arrives as 403 rather than 500, and `/team/reps-without-patch` is not shadowed by the
roster route.

One tool had to be widened for it: `route-security.registry.test.ts` recognised the
injected-plugin form only as the literal `authPlugin: any = auth`, so the better-typed
`authPlugin: typeof auth = auth` read as unguarded. It now matches any annotation whose
default is production `auth`, and still rejects an injected plugin with no default.

## 8.4 Verified on device (2026-08-12)

Everything above had been proved at the query, use-case and route layers. None of
it had been *used*. Driving the real app as a real manager found four defects
that no unit test could have, because each needed the whole chain — a manager
who exists, holding zones, with reps under them, tapping a control.

**What the manager path actually does**

| | Pedro | Silvio | Admin |
|---|---|---|---|
| Clínicas | 146 | 1134 | 1424 |
| Território | Rio de Janeiro | 3 territórios | global, unlabelled |
| Equipe | Adriana alone | 3 reps, 242 + 445 + 447 = 1134 | managers |

Filter drawers: options are the viewer's own (Silvio is offered his ten states
and his three reps, never Rio or São Paulo); search narrows, and a term with no
clinics in scope says so rather than offering a dead option; selection cascades
both ways — picking the *município* of Ananindeua selected Pará by itself and cut
1134 to 9, picking the *rep* Mauro Araujo selected Silvio by itself and cut it to
447, and clearing either parent dropped its child. Sorting Equipe by a metric
shows that metric per person. A rep's Desempenho, opened from the roster, drops
"Clínicas não atribuídas" and keeps everything else.

**The four defects**

1. **The managers had no linha.** `0101` created them and gave them zones but no
   `user_vertical_assignments` row, and `canAccessVertical` refuses outright on
   an empty list — a 403, not an empty result. They could sign in and see
   nothing: the exact "staffed but seeing nothing" failure that migration warns
   about in its own header.
2. **Sorting Equipe by any metric returned 403.** `findManagedUserIds` is a raw
   `db.execute` over a bigint column, so postgres-js returns strings while the
   signature promises `number[]`. `resolveSubject` asks
   `managedUserIds.includes(subjectUserId)` — `['4','5','6'].includes(4)` is
   false. Every earlier consumer fed those ids back into SQL, where the two
   compare equal, so the lie went unnoticed until something compared them in
   JavaScript.
3. **The cached user outlived the session.** Logout cleared the session and not
   the user, and `currentValueOrResolve()` returns a cached value without
   refetching, so signing in as somebody else kept the previous person's name
   and — through `currentUserRoleProvider` — their role. `UserRepository` now
   depends on `SessionEnvironment`, so it re-resolves when a session is
   established.
4. **"Clínicas não atribuídas" keyed off the viewer, not the subject** (§8.2),
   which is what made an admin opening a rep's Desempenho request a metric the
   API is right to refuse.

**Two operational notes.** Scopes are cached in Redis at `scope:user:<id>`, so a
scope resolved before a fix keeps its stale shape until it expires — both (1) and
(2) looked unfixed until that key was dropped. And the mobile app takes its API
from `--dart-define-from-file=config.development.json`; built without it, it
silently targets the default remote host rather than localhost.

## 8.5 Equipe redesigned (2026-08-12)

Desempenho is unchanged. The split now drawn: **Equipe answers *who*, Desempenho answers
*how much***, and every deeper question leaves Equipe rather than being reproduced there in
miniature.

**The N+1 the old rule created.** `ListTeamUseCase` called a metric use case once per member,
so a roster of N people cost N queries and could still only show one figure. `DrizzleTeamRepository.findMemberMetrics` replaces that with a single statement per roster:
one `scoped` CTE, then `COUNT(*) FILTER` for coverage and cadastro and a join for pedidos. Three
extra aggregates over a set already being scanned cost almost nothing, which is why showing four
metrics is cheaper than the old way of showing one.

The denominator is a property of *who is listed*, not of who is looking — `scope: "rep"` counts
open assignments, `scope: "manager"` counts profiles whose `manager_zone_id` is one of theirs
(§3). Only the head of the query differs; every count below it is shared, so the two readings
cannot drift. Penetração and clínicas sem representante stay per-member: neither is a count over
the roster's own scope, and both are computed only while they are the active sort.

**On the screen.** A summary strip totals the roster and, on a drill-down, links to that
manager's own Desempenho — the rows below are their reps, so nothing else led there. Coverage in
the strip is weighted by clinics rather than averaged across people: a mean would let 100% of two
clinics cancel out 2% of five hundred. Search appears past eight people and filters what is
already loaded. Sorting moved from seven scrolling chips into one button, since order is a
preference once the figures no longer depend on it.

**Two row semantics corrected.** A row now always opens *that person*; a manager's team moved to
its own control, because "tap a person" previously meant two different things depending on the
viewer's role. And the sort menu no longer offers "sem representante" on a rep roster — a rep
holds no zones, so the API can only answer null for everyone, which is an order that does not
exist.

**Verified.** Silvio on device: header 1134 / 3% / 4 pedidos over rows of 242, 445 and 447 —
the roster sums to the header, and the header agrees with his Desempenho. Sorting by cobertura
reordered to 1% / 2% / 5% with all three figures still on every row. Flavio's row (242, 5%)
opened his Desempenho showing 242 and 5%. Admin paths proved against the lane database: the
manager roster reads 144 / 146 / 1134 on zone scope, and drilling into Silvio returns his three
reps on assignment scope with pedidos 2 / 2 / 0 — summing to the 4 his own row shows.

---

## 9. Deferred

- **Admin CRUD surface** (item 12) — documented, not scheduled. Shortlist when picked up:
  `business_verticals` · `unit_types`/`unit_subtypes` (needed by item 14) ·
  `healthcare_specialties` · `occupations` · DELETE on the partial-CRUD entities
  (`products`, `healthcare_providers`, `territory_types`). Plus two argued for independently:
  **`audit.audit_logs` has no read endpoint at all** — a compliance trail nobody can read — and
  the **Emultec DLQ is visible only via psql**, which matters more once spec 0013 makes it the
  admin's signal for unregistered products.
- Atividade / visitas metrics.
- ADMIN vertical-scoping and SUPERUSER (spec 0010 §2.3).
