# Feature: Business Verticals (Multi-Sector Platform)

Branch: `feature/business-verticals-20260725`  
Status: **investigation + product alignment** (not implementing yet)

**Domain naming (locked)**

| Concept | Canonical name | Legacy (to rename away) |
|---|---|---|
| Business vertical entity | `business_verticals` | `sectors` |
| FK / column | `vertical_id` | `sector_id`, `primary_sector_id`, … |
| Join / assignment tables | `*_vertical_*` (e.g. `user_vertical_assignments`) | `*_sector_*` |
| API paths / DTOs / mobile models | `vertical` / `businessVertical` | `sector` / `Sector` |
| Medical specialty | Separate specialty model (not a vertical) | Must not reuse “sector” |

**Rename policy:** No parallel `sectors` + `business_verticals` tables. Migrate/rename in place (DB + API + mobile + web + docs) so the codebase speaks only “vertical”. Temporary compatibility aliases only if needed for a short dual-read window, with an explicit removal plan.

Spelling: `vertical` / `business_vertical` (not `verticall`).

---

## Foundational invariant (security)

> Business verticals are **security and data-isolation boundaries**. All vertical-scoped records must be filtered and authorized by the **backend** before they are returned. A user must never receive records associated exclusively with a vertical to which they do not have active access.

> A facility/professional is stored **globally** but commercially exposed through **vertical profiles**. A user may only discover a facility/professional through a profile (and assignment rules) they are authorized for. When an entity belongs to multiple verticals, the user sees only global identity fields plus commercial fields permitted in the **active** vertical.

Frontend sector selectors are UX only. Search, maps, exports, offline sync, and direct ID fetches must enforce the same rules.

---

## 1. Product intent (summary)

Evolve from an orthopedics-only sales app into a multi-vertical commercial platform (dermatology next; more later) by:

1. Keeping real-world entities **global** (facility, professional, user, geo territory, address).
2. Moving commercial ownership, relevance, catalog, goals, and reporting into **explicit vertical relationships**.
3. Making the **active vertical** a first-class request context (not a local UI filter).
4. Avoiding parallel apps/tables (`orthopedic_*` / `dermatology_*`), booleans, or a single `sector_id` / representative / potential on the global facility/professional.

Full product rundown lives in the planning conversation that produced this doc (sections on profiles, assignments, catalog attributes, dashboards, migration phases, testing, risks).

---

## 2. As-built investigation (code + local DB)

### 2.1 What already exists

```text
sectors  (id, slug, name, is_active)
   │
   ├── user_sector_assignments     (user × sector [× manager for REP])
   ├── invitation_*_assignments    (staged invite sectors/territories)
   ├── territories.sector_id       ⚠️ territory owned by ONE sector
   ├── facilities.primary_sector_id ⚠️ single sector ON facility (anti-pattern vs target)
   ├── product_sectors / competitor_product_sectors
   ├── conformity_requirements.sector_id
```

| Area | Status |
|---|---|
| Sector catalog CRUD API | Exists (`/sectors`, no DELETE) |
| Access sector list | Exists (`/access/sectors`) |
| User ↔ sector assign + invites | Exists (multi-sector assignments) |
| Territory create/edit `sectorId` | Exists (mobile); web weak |
| Product ↔ sector join | Exists |
| Scope: REP/MANAGER intersect territories by user sectors | Exists (`ScopeResolver.applySectorFilter`) |
| Direct facility assign | Exists as `facility_consultant_assignments` — **not vertical-scoped** |
| Facility commercial fields | `commercialStatus` / `purchaseStatus` on **global** facility |
| Explore / Map sector UI | **None** |
| Active vertical request context | **None** |
| Facility/professional vertical profiles | **None** |
| Medical specialty M2M + vertical↔specialty | **None** (CBO lookups are occupations, not this) |
| Vertical-aware cache/search/offline keys | **None** as a platform rule |
| Sector catalog seed in migrations | **None** |

### 2.2 Local DB snapshot (`atlasmed-3`, 2026-07-25)

| Metric | Value |
|---|---|
| Sectors | 1 — `orthopedics` |
| Facilities with `primary_sector_id` | 4518 → all orthopedics |
| Territories with `sector_id` | **0 / 48** |
| User sector rows | 4 (demo users → orthopedics) |
| Product sector rows | 14 |

**Bug-shaped gap today:** users with sector assignments + territories with `sector_id = null` → scope intersection empties territory-based visibility.

### 2.3 Critical mismatches vs target architecture

| Target rule | Current behavior | Severity |
|---|---|---|
| Territory geometry is global; ownership is vertical-scoped | `territories.sector_id` + `user_territory_assignments` unique on `(user, territory)` only | **High** |
| Facility commercial data per vertical | `primary_sector_id` + commercial enums on `facilities` | **High** |
| Direct clinic assignment per vertical | `facility_consultant_assignments` has no sector | **High** |
| Active vertical in every commercial API | Scope is user-global; no vertical header/path context | **High** |
| Specialty ≠ vertical | Specialty mostly free text / CBO; no vertical↔specialty map | Medium |
| Explore/map filter by vertical profile | Lists use facility scope only; no profile concept | **High** |
| Product attributes per vertical | Mostly fixed product columns + `product_sectors` join | Medium (later) |
| Orders/goals/opportunities carry vertical | Partially absent / not vertical-aware | Later |

---

## 3. Target domain shape (condensed)

```text
Platform
├── Global identity
│   Users, professionals, facilities, addresses, geo territories, manufacturers…
├── Vertical configuration
│   Vertical defs, specialties, vertical↔specialty, features, terminology,
│   product attributes/categories, dashboard defs…
├── Vertical relationships
│   User↔vertical roles, facility profiles, professional profiles,
│   product membership, territory assignments, direct facility assignments…
├── Commercial operations (vertical-scoped)
│   Opportunities, orders, goals, samples, campaigns…
└── Analytics (vertical or consolidated-with-permission)
```

**Facility visibility chain (target):**

```text
User → verticals they can access (from assignments; ADMIN = all)
    → optional verticalId filter (esp. ADMIN narrowing)
    → facilities with facility_vertical profile in those verticals
    → further restricted by assignment rules (direct facility assign now;
       territory-based ownership when territory module is redesigned)
```

**Professionals (locked):** no professional vertical profile required. Visibility follows the clinic: if the REP/MANAGER can see the facility in a vertical, associated professionals at that facility are visible in that commercial context.

---

## 4. Locked product decisions (2026-07-25)

| # | Topic | Decision |
|---|---|---|
| 1 | UI copy (pt-BR) | Use **“Vertical”** |
| 2 | API shape | **No vertical in path.** Infer accessible verticals from the authenticated user. Optional `verticalId` filter when the caller may see more than one (esp. ADMIN) and wants one. |
| 3 | Global access | **ADMIN only** is global across verticals. **OPS is vertical-scoped** (not global). |
| 4 | Facility with no profile | **ADMIN only** (hidden from REP/MANAGER) |
| 5 | Professional profiles | **Not required.** Professionals surface via clinic association |
| 6 | Facility × vertical reps | **One REP** per facility per vertical |
| 7 | Territory module | **Out of P0 redesign.** Drop `territories.sector_id` if safe; do not block vertical work on a territory rewrite. Design vertical foundation so territory ownership can be reworked later. |
| 8 | Direct vs territory override | **Not in P0** (comes with territory review) |
| 9 | Assignment history | **Current assignee only** for now. A clinic **may have multiple verticals** ⇒ one REP per vertical ⇒ multiple REPs on the same clinic across verticals (see §4.1) |
| 10 | `territories.sector_id` | **Drop** if it does not break P0 (ownership moves off the territory row) |
| 11 | Commercial fields | **Move** onto facility vertical profile; redesign dependent flows (incl. **cadastro**) around `verticalId` |
| 12 | Seed | **Only Ortopedia** — code `ORTOPEDIA`, display name `Ortopedia` |
| 13 | Product catalog by vertical | **Defer to P1** |
| 14 | First ship slice | **(B)** rename + facility profiles + vertical-aware access together |
| 15 | P0 exclusions | None beyond what’s already deferred above |

### 4.1 Multiple verticals on one clinic — multiple REPs?

**No problem** if uniqueness is:

```text
UNIQUE active (facility_id, vertical_id) → one responsible REP
```

Then:

```text
Clinic X
├── Ortopedia profile → REP A
└── Dermatologia profile → REP B
```

That is **not** two REPs in the same vertical; it is one REP per vertical. Same clinic, two commercial ownerships. Detail/API responses must never mix commercial fields across verticals.

---

## 5. Priority cut — what to do now vs later

### P0 — Foundation (first ship = rename + profiles + access)

Goal: Ortopedia runs through a vertical-aware model; ADMIN can filter; REP/MANAGER only see profiled facilities in their verticals; territory module left mostly untouched.

| # | Work item | Why now |
|---|---|---|
| P0.1 | **Rename** `sectors` → `business_verticals` (+ all `sector_*` → `vertical_*` across DB/API/mobile/web); seed Ortopedia | Naming + catalog |
| P0.2 | Resolve accessible `verticalIds` from user; optional `verticalId` query/body filter (ADMIN); **not** in URL path | Access model |
| P0.3 | **`facility_vertical_profiles`** (name TBD); move commercial fields here; retire `primary_sector_id` | Multi-vertical clinics |
| P0.4 | Backfill profiles for existing facilities → Ortopedia | No empty commercial world |
| P0.5 | Scope facility lists / map / explore by profiles ∩ user verticals (unprofiled = ADMIN only) | Isolation |
| P0.6 | Professionals: no new profile table; filter via facility visibility | Matches decision #5 |
| P0.7 | Direct facility assign: add `vertical_id`, enforce one active REP per `(facility, vertical)` | Ownership without territory rewrite |
| P0.8 | Drop `territories.sector_id`; **do not** redesign territory assignment module in P0 | Unblocks geometry-as-global |
| P0.9 | Cadastro (and similar) redesigned around `verticalId` / facility profile | Decision #11 |
| P0.10 | Mobile/web: “Vertical” copy; identifier rename; caches keyed by vertical where scoped | UX + leak prevention |

**P0 explicitly out:** territory ownership rewrite, assignment history, professional vertical profiles, product catalog vertical filtering, dermatology seed, attribute engine, campaigns/goals/samples, consolidated non-admin views.

### P1 — Dermatology-ready commercial core

| # | Work item |
|---|---|
| P1.1 | Product↔vertical membership as catalog visibility path |
| P1.2 | Seed/configure Dermatologia + feature flag |
| P1.3 | Medical specialty catalog + M2M + vertical↔specialty (if needed for filtering) |
| P1.4 | Territory module review: vertical-scoped ownership, override rules |
| P1.5 | Orders store `vertical_id`; one vertical per order |
| P1.6 | Search indexes include `vertical_ids` |
| P1.7 | Vertical admin UX polish |

### P2 — Platform depth (later)

| # | Work item |
|---|---|
| P2.1 | Hybrid product attribute definitions + typed values |
| P2.2 | Competitor variant matching |
| P2.3 | Dashboards / terminology packs / feature flags per vertical |
| P2.4 | Goals, opportunities, samples, campaigns |
| P2.5 | Segmentation model versioning |
| P2.6 | Assignment history / validity windows |
| P2.7 | Consolidated views for non-admin (explicit permission) |
| P2.8 | Offline sync by vertical |
| P2.9 | CASL policies per vertical action |
| P2.10 | Vertical lifecycle (deactivate) + orphan policy |
| P2.11 | Ingestion auto-suggest profiles without clobbering manual overrides |

### P2 — Platform depth (later)

| # | Work item |
|---|---|
| P2.1 | Hybrid product attribute definitions + typed values |
| P2.2 | Competitor variant matching with relationship types |
| P2.3 | Sector-specific categories, dashboards, terminology packs |
| P2.4 | Goals, opportunities, samples, campaigns as first-class vertical ops |
| P2.5 | Segmentation model versioning (raw/normalized scores) |
| P2.6 | Assignment history / validity windows everywhere |
| P2.7 | Consolidated manager views (`vertical_data:view_consolidated`) |
| P2.8 | Offline sync packages scoped by vertical |
| P2.9 | CASL subject / policies per vertical action |
| P2.10 | DELETE/deactivate vertical lifecycle + orphan policy |
| P2.11 | Ingestion: auto-suggest profiles from CNES services/occupations without overwriting manual overrides |

---

## 6. Migration phasing (scoped)

| Phase | Cut |
|---|---|
| 1 | Assumptions inventory (this doc §2) |
| 2 | Rename + `business_verticals` + facility profiles + access rules (**P0**, ship slice B) |
| 3 | Cadastro + commercial fields on profiles |
| 4 | Stabilize Ortopedia on new model |
| 5 | Dermatologia + catalog filtering (**P1**) |
| 6 | Territory module redesign (**P1/P2**) |

### Rename inventory (minimum surface)

| Layer | Examples |
|---|---|
| DB tables | `sectors` → `business_verticals`; `user_sector_assignments` → `user_vertical_assignments`; `invitation_sector_assignments` → `invitation_vertical_assignments`; `product_sectors` → `product_verticals` |
| DB columns | `sector_id` → `vertical_id`; drop `primary_sector_id` / `territories.sector_id` as decided |
| API | list/filter `verticalId` (optional); routes stay resource-centric (no `/verticals/{id}/…` nesting); DTO `sectorId` → `verticalId` |
| packages/access | `assignedSectorIds` → `assignedVerticalIds` |
| Mobile / web | models, providers, “Vertical” copy |
| Seed | code `ORTOPEDIA`, name `Ortopedia` |

---

## 7. What must not be done (enforcement checklist)

From product §5 — treat as review gates:

- [ ] No `orthopedic_*` / `dermatology_*` duplicate entity tables
- [ ] No separate DB or mobile app per vertical
- [ ] No scatter of `isOrthopedics` / `isDermatology` booleans
- [ ] No hardcoded frontend `if (sector == dermatology)` field lists — use vertical config for presentation
- [ ] No single commercial `sector_id` / representative / potential on global facility or professional as the long-term model
- [ ] No “hide in Flutter” for unauthorized vertical rows
- [ ] No cache/search/offline keys without vertical where data is vertical-scoped

---

## 8. Testing bar (minimum for P0)

- Orthopedics-only user never receives dermatology-only facilities (list, map, detail-by-id, search).
- Multi-vertical user sees only active-vertical commercial fields.
- Global address update visible in both profiles; deleting a profile does not delete facility.
- Direct assignment overrides territory only inside that vertical.
- Cache key / response with wrong vertical never served.
- Legacy user with only orthopedics: app auto-selects; behavior matches pre-change for their data.

---

## 9. Key file index (current code)

| Layer | Path |
|---|---|
| Schema verticals | `packages/database/src/schema/public/business-verticals.ts` |
| Facility (+ consultant assign + profiles) | `packages/database/src/schema/public/facilities.ts` |
| Territory assign | `packages/database/src/schema/public/territories.ts` |
| Scope resolver | `apps/api/src/modules/access/application/services/scope-resolver.service.ts` |
| Catalog verticals | `apps/api/src/modules/catalog/infrastructure/routes/catalog.route.ts` (`/business-verticals`) |
| Access verticals | `apps/api/src/modules/access/infrastructure/routes/verticals.route.ts` |
| Mobile vertical selector / filter | `apps/mobile/lib/features/territories/presentation/widgets/vertical_selector.dart`, `apps/mobile/lib/core/user/facility_vertical_filter_bar.dart` |
| Access feature doc | `docs/architecture/features/access-auth.md` |

---

## 10. Next steps

1. ~~Clear remaining open questions~~ — decisions locked (§4, §11).
2. Implement P0 ship slice B on this branch: rename + facility profiles + vertical-aware access (+ cadastro vertical awareness).
3. Keep territory module changes minimal (drop `sector_id` only); full territory redesign later.
4. After Ortopedia is stable: P1 (Dermatologia, catalog filtering, territory review).

---

## 11. Locked answers (follow-up, 2026-07-25)

| # | Topic | Decision |
|---|---|---|
| 1 | OPS | **Vertical-scoped** (not global) |
| 2 | Optional `verticalId` on API | See §11.1 — not “omit the user’s verticals”, optional **filter** when the caller may see more than one |
| 3 | Territory / REP access in P0 | Territory module stays; add `vertical_id` where needed (e.g. direct facility assign). Drop `territories.sector_id`. No territory ownership redesign in P0. REP visibility uses profiles + user verticals + existing assignment/scope paths updated for vertical. |
| 4 | Ortopedia code | `ORTOPEDIA` |
| 5 | Cadastro vertical | **Inferred** from facility profile(s) and user verticals: if facility has one profile → use it; if facility has many and user has one vertical → use the user’s vertical; if **both** have many → **`verticalId` required** |

### 11.1 What “optional `verticalId`” means

The user’s vertical associations always come from the DB (`user_vertical_assignments`).

`verticalId` on a request is only an optional **narrowing filter**:

| Caller | No `verticalId` | With `verticalId` |
|---|---|---|
| ADMIN | All verticals (global) | Only that vertical |
| OPS / MANAGER / REP | **Union** of **their** assigned verticals (**confirmed**) | Only that vertical (must be one they can access) |

So “omit `verticalId`” = “do not pass the filter”; it does **not** mean the user has no verticals.

### 11.2 P0 change surface (vs “only vertical_id”)

For territory: mostly leave alone except drop `territories.sector_id` and stop using it in scope.

Still required for ship slice B (not territory redesign):

- Rename sector → vertical everywhere
- `facility_vertical_profiles` + move commercial fields
- Backfill Ortopedia profiles
- Scope/list/map/explore honor profiles + user verticals
- Direct facility assign gains `vertical_id` (one REP per facility×vertical)
- OPS no longer global
- Cadastro inference rules above
- UI “Vertical”

---

## 12. Source notes

- Code investigation: 2026-07-25 on `atlasmed-3` + monorepo scan (api/mobile/web/database).
- Product architecture: “Multi-Sector Architecture for the Sales Application” rundown + access-isolation addendum (user-provided).
