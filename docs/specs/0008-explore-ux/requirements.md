# Spec 0008: Explorar UX (filters, distance, location gate)

**Status:** In progress — product decisions locked for v1; see [tasks.md](./tasks.md)  
**Last Updated:** 2026-07-23  
**Branch:** `feature/explore-ux-20260723`  
**Domains:** `apps/mobile` (primary), `apps/api` (facility/professional list query contract), `packages/database` (optional GiST index)  
**Related:**
- [Spec 0005 — Mobile Establishment Detail](../0005-establishment-detail-mobile/requirements.md) (Explorar → clinic detail)
- [api-mobile integration](../../ai/integration-tasks/api-mobile.md)

> **Scope boundary (v1):** Mobile Explorar list UX + **full-app location hard gate**. Web Explorar is out of scope. Background / always-on tracking is out of scope unless product later requires navigation.

## User stories

1. As a field user, I want Explorar to show clinics organized by distance from me (bands), with clear distance labels and an optional radius filter, so I can plan visits nearby.
2. As a field user, I want reliable filters (starting with commercial **status**) that match what the API understands, so the list is trustworthy.
3. As the product, we want location available before any authenticated shell is usable, so distance-based Explorar (and map) never run in a “no GPS” half-state.

## Product scope (v1)

| In scope | Out of scope (deferred) |
|---|---|
| **Full-app location hard gate** after login (mobile) | Web admin / web Explorar |
| Explorar distance display (only when real) | Background location / always permission |
| Distance sort (API-backed) | Driving-time / Mapbox Matrix ranking |
| Radius filter on **clinics** tab only (clearable) | Radius filter on doctors tab |
| Distance **bands** on clinics (and doctors display/sort) | Fake `0.0 km` placeholders |
| Commercial **status** filter (API enums, pt-BR labels) | Broken Portuguese status slugs (`ativa`, …) |
| Doctor filters distinct from clinic (e.g. specialty) | Dev/simulator location bypass flag |
| Periodic + enter + pull GPS refresh while Explorar open | Offline-first explore cache redesign |

## Locked decisions

1. **Full-app location hard gate (mobile).** After a successful login (authenticated session exists), the user SHALL NOT enter the normal app shell until location **permission is granted** and **device location services are enabled** enough to obtain a current position (or a short timed retry fails → stay on the gate with retry / open settings).
2. **Gate applies to all authenticated roles** on mobile in v1 (REP, MANAGER, ADMIN, OPS). No role bypass in v1.
3. **While-in-use is enough for v1.** Do not request “always” / background location for this feature.
4. **No debug bypass.** Simulator must grant location like a device (Custom Location / Features → Location).
5. **Distance is first-class.** With location available, lists SHALL send `latitude`/`longitude` and display API `distanceKm` — never a fake `0.0` when distance is unknown.
6. **Default radius = none (no limit).** Explorar starts with all scoped results sorted by distance. Applying a radius chip adds `radiusKm`; **clearing** that filter removes `radiusKm` (no separate “Sem limite” chip).
7. **Radius chip set (clinics only):** `5`, `10`, `25`, `50`, `100` km. Multi-select is **not** required; treat as single-select chip (or equivalent). Clear removes the filter.
8. **Doctors tab:** same hard-gate position, show distance, sort by distance — but **no radius / distance filter**. Doctor filters are a separate set (see below).
9. **List organization = distance bands** on the distance-sorted feed (visual section headers as the user scrolls). Pagination remains distance-ordered globally so bands stay coherent.
10. **GPS freshness on Explorar:** refresh position (a) when entering Explorar, (b) on pull-to-refresh, (c) periodically while the Explorar screen is open (interval TBD in design; suggested 60–120s).
11. **No proximity toggle.** Location is app precondition; radius is a normal clearable clinic filter.
12. **Reuse existing list APIs** for geo. Prefer extending query params over a new search stack.
13. **Clinic filter “Status”** maps to API `commercialStatus`: `UNREGISTERED` \| `REGISTERED` \| `SUSPENDED` \| `CLOSED` with pt-BR labels (Pré-cadastro / Operante / Suspensa / Encerrada).

## Suggested distance bands (clinics + doctors UI)

Visual only (client groups a distance-sorted stream):

| Band | Range |
|---|---|
| Muito perto | `< 2 km` |
| Perto | `2–10 km` |
| Na região | `10–25 km` |
| Mais longe | `≥ 25 km` |
| Sem localização | `distanceKm` null (end of list, if any) |

Exact km cutoffs can be tuned in design; principle is band headers on a globally distance-sorted list.

## Filters

### Clinics tab (v1 locked + candidates)

**Locked for v1**

| Filter | UI | API |
|---|---|---|
| Status | Single/multi TBD; label “Status” | `commercialStatus` = `UNREGISTERED` / `REGISTERED` / `SUSPENDED` / `CLOSED` |
| Distância (raio) | Chips 5 / 10 / 25 / 50 / 100 km; clearable | `radiusKm` when set; omit when cleared |

**Strong candidates (pick next — need API support check / small API adds)**

| Candidate | Why it helps field reps | Backend today |
|---|---|---|
| **Produtos** | “Who uses AtlasGel?” | `productIds` already on list API — wire to real catalog IDs |
| **Situação de compra** (`purchaseStatus`) | Pipeline focus | Column exists; **list filter not exposed yet** |
| **Conformidade** (`conformityStatus`) | Cadastro / docs incomplete | Column + index exist; **list filter not exposed yet** |
| **Cidade** | Local routing day | Often on row; **list filter not exposed yet** |
| **Com/sem visita recente** | Who to visit next | Needs visit aggregate + query param (not on list today) |
| **Atribuídas a mim / território** | Personal patch | Scope already limits visibility; “mine only” may be redundant for REP |

**Not recommended as clinic filters**

- Especialidade (doctor concept).
- Fake CRM statuses from the old mock UI (`nunca`, `rejeicao`, …) unless they map 1:1 to a real enum.

### Doctors tab (v1)

| Filter | UI | API |
|---|---|---|
| Especialidade | Chips from scoped facet list (no hardcoded labels) | Facet: `GET /healthcare-professionals/specialties` → `{ data: string[] }`; filter list with `specialty` |
| ~~Raio~~ | — | **Do not send `radiusKm`** |

Distance **display + default sort** still use `latitude`/`longitude` (and `sort=distance` when applicable).

## Current state (investigation summary)

### API / DB

- Facilities: `latitude`, `longitude`, `radiusKm`, `sort`, `search`, `commercialStatus`, `productIds`.
- Healthcare professionals (persons): geo + `specialty` (+ `facilityId`); specialty facet via `GET /healthcare-professionals/specialties`; **no** commercial-status-style filters. List path: `GET /healthcare-professionals` (Meili `persons` when searching).
- `facilities.location` PostGIS point; **no GiST index** yet.

### Mobile gaps

- Opt-in proximity; fake `0.0 km`; client-only distance sort; wrong status slugs; fixed 50 km.

## Acceptance criteria

### Location hard gate

1. WHEN a user completes login (or restores a valid session on cold start) AND location is not yet usable THEN the system SHALL show a dedicated full-screen gate (not the tab shell) with enable / open settings / retry — and **no skip**.
2. WHEN location becomes usable THEN the system SHALL enter the authenticated shell and cache the position for Explorar/map.
3. WHEN the app resumes while authenticated THEN the system SHALL re-validate location; IF unusable THEN return to the gate.
4. WHILE authenticated THEN the system SHALL continuously monitor location usability (OS services stream + periodic soft check); IF location becomes unusable mid-session THEN return to the gate immediately (no skip).
5. IF permission is denied or services stay off THEN the system SHALL remain on the gate.
6. Gate copy SHALL be pt-BR and on-brand.

### Explorar distance (clinics)

7. WHEN Explorar clinics loads THEN the client SHALL send `latitude`/`longitude`, omit `radiusKm` until a radius chip is selected, and order by distance (API).
8. WHEN a radius chip is selected THEN refetch with that `radiusKm`; WHEN the chip is cleared THEN refetch without `radiusKm`.
9. WHEN `distanceKm` is present THEN show formatted distance; WHEN absent THEN do not show `0.0 km`.
10. WHEN results are shown THEN the list SHALL use **distance band** section headers on the distance-sorted stream.
11. Chrome (search / filters / sort) SHALL stay mounted across radius/status refetch; only the card list refreshes.

### Explorar doctors

12. WHEN Explorar doctors loads THEN the client SHALL send `latitude`/`longitude` for distance display/sort and SHALL NOT send `radiusKm`.
13. Doctor filters SHALL be specialty-oriented (and any later doctor-only filters), not clinic status/radius.

### GPS refresh

14. WHEN the user enters Explorar OR pull-to-refreshes OR the periodic timer fires while Explorar is visible THEN the system SHALL refresh the current position and refetch the active tab list.

### Status filter

15. WHEN the user filters by Status THEN the client SHALL send API `commercialStatus` values (`UNREGISTERED` \| `REGISTERED` \| `SUSPENDED` \| `CLOSED`) with pt-BR labels in the UI.

## Locked decisions (was open — closed 2026-07-23)

| # | Decision |
|---|---|
| Q7b | v1 clinic filters = **Status** + **Distância (raio)**. Produtos deferred. Purchase / conformity / city / visits deferred. |
| Q7c | Status = **single-select** (API `commercialStatus` string). |
| Q8 | Band cutoffs: `<2` / `2–10` / `10–25` / `≥25` km; null distances last. |
| Q9 | Periodic GPS refresh **90s** while Explorar is visible. |

## Non-goals

- Replacing territory scope with GPS.
- Using GPS to rewrite facility coordinates.
- Realtime multi-user list sync.
- “Continue without location”.

## Success metrics (qualitative v1)

- Users cannot reach the shell without usable location (simulator included).
- No wall of `0.0 km`.
- Clinics: bands + clearable radius; doctors: distance without radius filter.
- Status filter uses real commercial enums.
