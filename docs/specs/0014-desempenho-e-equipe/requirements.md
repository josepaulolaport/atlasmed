# Spec 0014 — Desempenho & Equipe

**Status:** Accepted (2026-08-10)
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

**Sorting:** alphabetical by default; sortable ascending/descending **by any metric**. When a
metric sort is active, that metric's value is shown per person — so the roster becomes a
leaderboard on demand.

Consequence for the API: the team endpoint computes **only the active sort metric** per member,
not all of them. Cheap at real team sizes, and it preserves the load-separately rule.

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
