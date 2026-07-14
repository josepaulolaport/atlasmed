# Backlog

Items deferred from the main phase plan. Address after Phase 4 is complete or when there is a specific reason to pull something forward.

---

## Design system unification

The web app has two visual eras coexisting: new pages use iconify + zinc palette, older pages use lucide + gray palette.

**Tasks:**
- [ ] Audit all files importing `lucide-react` (~30 files including UI primitives)
- [ ] Replace each lucide icon with the equivalent Solar iconify icon
- [ ] Replace all `gray-*` Tailwind classes with `zinc-*` equivalents in affected files
- [ ] Enforce via ESLint rule: no `lucide-react` imports, no `gray-` color classes
- [ ] Verify visual consistency across all pages after the change

**Files known to need work:** `components/ui/select.tsx`, `components/ui/dialog.tsx`, `components/ui/dropdown-menu.tsx`, `components/ui/toast.tsx`, territory sub-pages, users/invite components, unauthorized page

---

## `packages/config` consolidation

Currently two parallel config systems:
- TypeBox validation in `apps/api/src/app/config/environment.ts` (comprehensive, ~470 lines, what the server actually uses)
- Zod validation in `packages/config` (partial subset, only ~10 API files import it)

**Tasks:**
- [ ] Decide: consolidate to TypeBox in API / consolidate to Zod in packages/config
- [ ] Remove the unused system
- [ ] Ensure all env var access goes through one path
- [ ] Complete `packages/config/src/env/web/` (currently empty files)

---

## `packages/observability` decision

The package has a complete OTEL implementation that nothing imports. The API built its own Pino + Elysia OTEL stack instead.

**Tasks:**
- [ ] Decide: adopt `packages/observability` in workers and web / deprecate the package / rewrite it as a thin Pino wrapper
- [ ] If deprecating: remove the package, clean up `bun.lock`, remove from workspace references
- [ ] If adopting: wire it into workers and web

---

## TanStack Query

The web app uses manual `useState` + `useEffect` + `useCallback` for every data fetch. There is no cache layer. This causes:
- Repetitive code across ~25 pages
- No background refetching
- Manual `refreshKey` counter pattern to trigger refetches

**Tasks:**
- [ ] Add TanStack Query as a dependency to `apps/web`
- [ ] Wrap the axios API modules with query key conventions
- [ ] Migrate pages one at a time, starting with the most data-heavy (facilities, territory, users)
- [ ] Remove manual `refreshKey` patterns

---

## Next.js RSC migration

28 of 29 dashboard pages are `"use client"`. The app gets none of the Next.js App Router benefits (RSC, streaming, layout-level data fetching).

This is a significant refactor. Pull it forward only if performance or SEO becomes a concrete concern.

**Tasks:**
- [ ] Identify pages that have no interactivity beyond links and simple reads (good RSC candidates)
- [ ] Move data fetching to server components where possible
- [ ] Keep client components for interactive forms and real-time elements
- [ ] Add `middleware.ts` for auth redirect (this one should happen sooner — consider pulling to Phase 2)

Note: `middleware.ts` is a quick win and should probably be done in Phase 2, not deferred here.

---

## Access repository `any` types

Repository interfaces in `packages/access` use pervasive `any` types at the persistence boundary.

**Files:**
- `user.repository.interface.ts`
- `session.repository.interface.ts`
- `invite.repository.interface.ts`
- `password-reset.repository.interface.ts`

**Tasks:**
- [ ] Define proper return types for each repository method
- [ ] Update Prisma implementations to match
- [ ] Verify no type errors after change

---

## Temporal workflow versioning

Once workflows run in production, changing activity implementations without version patches causes non-determinism errors for in-flight workflow executions.

**Tasks:**
- [ ] Add Temporal `patched()` / `deprecatePatch()` guards to `cnes-monthly-ingestion.workflow.ts` before any activity signature changes
- [ ] Document versioning policy in `apps/workers/AGENTS.md`

---

## Organization / multi-tenancy

If the Phase 1 decision was to defer the `Organization` model, it lives here.

**Tasks:**
- [ ] Design the `Organization` model (name, slug, plan tier, status, billing info)
- [ ] Add FK relations on `User`, `Territory`, `Facility`
- [ ] Implement organization-scoped queries in all repositories
- [ ] Build organization management admin UI
- [ ] Update CASL to include organization scope in ability definitions

---

## PostGIS geographical queries

The database schema uses PostGIS geometry types (`point`, `geometry(Polygon, 4326)`) for facility locations and territory boundaries, but queries currently use flat column comparisons or skip spatial filtering entirely. PostGIS operators and indexes are unused.

**Why this matters:**
- `ST_DWithin` on a spatial index is orders of magnitude faster than bounding-box lat/lng arithmetic on large datasets
- Territory scoping (which facilities a rep sees) is currently done by joining `user_territory_assignments` and matching against a list; it should use `ST_Within` or `ST_Intersects`
- Distance-ordered searches ("find the 10 nearest facilities") are impossible without `ST_Distance` / `ST_ClosestPoint`

**Affected queries (in priority order):**

| Query | Current | Target |
|---|---|---|
| Facility search: spatial filter | none | `ST_DWithin(facilities.location, ST_SetSRID(ST_Point($lng,$lat),4326), $radius_meters)` |
| Facility search: order by distance | manual in-process sort | `ORDER BY ST_Distance(facilities.location, ...)` |
| Territory membership check | join on assignment table | `ST_Within(facility.location, territory.boundary)` |
| Territory boundary query: which facilities fall in a territory | none | `ST_Within(f.location, t.boundary)` |
| Find territories containing a point | none | `ST_Contains(t.boundary, ST_SetSRID(ST_Point($lng,$lat),4326))` |

**Tasks:**
- [ ] Enable GIST index on `facilities.location` (confirm it exists in schema — it should, check migration)
- [ ] Enable GIST index on `territories.boundary`
- [ ] Add `ST_DWithin` filter to `DrizzleFacilityRepository.findAll` (accepts optional `nearLat`, `nearLng`, `radiusMeters`)
- [ ] Add `ST_Distance` ordering to facility search when `near*` params are provided
- [ ] Add `ST_Within(facility.location, territory.boundary)` join to territory-scoped facility queries in `DrizzleFacilityMembershipWriter`
- [ ] Add `findFacilitiesInTerritory(territoryId)` to `FacilityRepository` using boundary join
- [ ] Add `findTerritoriesContainingPoint(lat, lng)` to `TerritoryRepository`
- [ ] Write typed raw SQL helpers for complex spatial queries (e.g. nearest-N with distance returned)
- [ ] Update API endpoints to accept and forward spatial params (`nearLat`, `nearLng`, `radiusKm`)
- [ ] Add spatial param validation in route schemas

**Notes:**
- All PostGIS calls should go through typed raw SQL helpers in `packages/database/src/` — never inline SQL strings in repositories
- Use geography type (`ST_SetSRID(..., 4326)`) for distance calculations involving real-world meters
- Use a GiST index, not a B-tree, for spatial columns — verify in migration
- Test with real Brazilian municipality coordinates

---

## Auth context performance

The auth context re-bootstraps (re-fetches profile) on every `pathname` change in the dashboard. This causes unnecessary API calls and loading flickers when navigating between pages.

**Tasks:**
- [ ] Refactor `auth-context.tsx` to bootstrap once on mount (not on every pathname change)
- [ ] Use a stable session check instead of re-fetching the full profile on navigation
