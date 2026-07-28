# Spec 0008 — Tasks: Explorar UX + location hard gate

**Status:** In progress  
**Branch:** `feature/explore-ux-20260723`  
**Locked leftovers (2026-07-23):**
- **Q7b:** v1 clinic filters = Status + Distância (raio). Produtos deferred. Purchase/conformity/city/visits deferred.
- **Q7c:** Status = **single-select** (matches API `commercialStatus` string).
- **Q8:** Band cutoffs `<2` / `2–10` / `10–25` / `≥25` km (+ nulls last).
- **Q9:** Periodic GPS refresh **90s** while Explorar is visible.

## Phase A — Spec + plumbing

- [x] Requirements + design drafted
- [x] Lock Q7b/Q7c/Q8/Q9
- [x] Align mobile `API_BASE_URL` with local API port for manual QA

## Phase B — Location hard gate (mobile)

- [x] `LocationSession` Riverpod notifier (permission + services + position; no bypass)
- [x] `LocationGateScreen` (pt-BR, no skip; enable / retry / open settings)
- [x] `GoRouter` redirect: authenticated && !usable → gate; resume re-validates
- [x] Unit tests for session (fake `LocationPlatform`)

## Phase C — Explorar distance + filters

- [x] Always send `latitude`/`longitude` from session (remove proximity opt-in toggle)
- [x] Clinics: default omit `radiusKm`; chips `5|10|25|50|100`; clear removes param
- [x] Doctors: lat/lng only — never `radiusKm`
- [x] Pass API `sort=distance` when coords present (clinics)
- [x] Status filter → `UNREGISTERED|REGISTERED|SUSPENDED|CLOSED` with pt-BR labels (single)
- [x] Produtos filter deferred (removed from Explorar filter sheet)
- [x] Nullable `distanceKm` on models/cards — never display fake `0.0`
- [x] Distance band section headers on sorted lists
- [x] GPS refresh: enter Explorar + pull-to-refresh + 90s timer (refetch if moved >150 m)
- [x] Widget/unit tests for filters, bands, distance display

## Phase D — API / DB follow-ups (optional in this PR)

- [ ] GiST index on `facilities.location` (perf)
- [ ] Defer `purchaseStatus` / `conformityStatus` list filters

## Done when

- Gate blocks shell without usable location (simulator included).
- Clinics: bands + clearable radius + commercial status.
- Doctors: distance without radius filter; specialty filter.
- No `0.0 km` placeholders.
