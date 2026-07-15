# AGENTS.md

Canonical AI instruction file for the AtlasMed monorepo. Every AI agent must read this file before editing code or documentation.

## Repository structure

| Path | Tech | Purpose |
|---|---|---|
| `apps/api` | Bun + Elysia | Backend API, Drizzle ORM, PostgreSQL/PostGIS, CASL authorization |
| `apps/mobile` | Flutter | Mobile app (migration to React Native/Expo — see `docs/architecture/adr/0002-mobile-stack.md`) |
| `apps/web` | Next.js 16 | Admin/web app |
| `apps/workers` | Temporal | Workflow workers (registry ingestion, background jobs) |
| `packages/database` | Drizzle | Schema, migrations (Drizzle Kit), DB client, PostGIS geometry types |
| `packages/access` | CASL | Authorization rules, roles, row-level access |
| `packages/cnes-ingestion` | — | CNES/DataSUS adapters (FTP, parsing) |
| `packages/mapbox` | — | Mapbox API client wrappers (geocoding, directions, matrix) |
| `packages/config` | Zod | Shared runtime config, env parsing, feature flags |
| `packages/observability` | — | Structured logging, distributed tracing, metrics |
| `packages/ui` | — | Shared UI primitives (future — atoms currently inline in `apps/web`) |

## Task lifecycle (mandatory)

Every AI editing session runs these steps in strict order.

### Step 0 — Worktree + branch (HARD GATE)

**Never edit on `main`/`master` or in the primary checkout.** Always work inside a dedicated git worktree on a feature branch.

```bash
# If on main or not in a linked worktree:
git worktree add ../atlasmed-worktrees/<slug> -b <type>/<slug>-YYYYMMDD
```

Verify: `git rev-parse --git-dir` differs from `git rev-parse --git-common-dir` in a linked worktree.

Do not skip this because the change "looks small."

### Step 1 — Classify

```
domain(s):   web | api | mobile | workers | shared-package    (1 or more)
concerns:    authorization | persistence | styling | testing | docs |
             api-contract | background-jobs | offline-first | …
```

### Step 2 — Route

| Trigger | Load |
|---|---|
| Always | this file |
| Single domain | see § Domain guides below for that area's conventions + required docs |
| Cross-boundary (2+ domains) | `docs/ai/integration-tasks/<combo>.md` FIRST — it names exact next-step files |
| Concern involves authorization or security | see § Domain guides → `packages/access` |
| Concern involves persistence or domain model | see § Domain guides → `packages/database` |
| Concern involves background jobs / messaging | see § Domain guides → `apps/workers` |
| Concern involves observability or audit | see § Domain guides → `packages/observability` |
| Concern involves configuration | see § Domain guides → `packages/config` |

`docs/ai/context-map.md` is a fuller dispatch table by domain, procedure, and concern.

### Step 3 — Load docs (only when named)

Load `docs/product/*`, `docs/architecture/*`, or `docs/specs/*` ONLY when a domain guide below explicitly names them. Never load "just in case."

### Step 4 — Announce load list

```
Loading:
  <file 1>
  <file 2>
  …
```

User can veto or add files. Prune if over budget.

### Step 5 — Post-work update

When behavior or a convention changes, update the matching docs in the same PR. Do not defer.

## Budget

- Single-domain: ≤ 10 files loaded.
- Cross-boundary: ≤ 15 files loaded.
- Over budget → routing is broken. Prune before continuing.

| Tier | Contents | Drop last |
|---|---|---|
| 0 | this file | never |
| 1 | domain guide section + integration doc (if cross-boundary) | never |
| 2 | secondary domain guides triggered by concerns | rarely |
| 3 | product/architecture/spec docs | first |

## Repository structure rules

- Never import one app from another app.
- Shared code belongs in `packages/*`, never inside `apps/*`.
- UI apps must not depend directly on database models — go through backend DTOs.
- Backend exposes explicit DTOs/contracts, never raw Drizzle row types.
- Do not duplicate business rules across api, mobile, and web.
- If a change crosses app boundaries, name every affected area BEFORE editing.

## Branch and merge workflow

### Branch naming (locked)

Pattern: `<type>/<slug>-YYYYMMDD`

| Type | Use for |
|---|---|
| `feature/` | New capability or product surface |
| `fix/` | Bug fix (behavior correction) |
| `refactor/` | Restructure without behavior change |
| `chore/` | Tooling, deps, config, meta files |
| `docs/` | Docs-only change |
| `spec/` | New spec / ADR / product doc |
| `experiment/` | Throwaway exploration — auto-delete after 7 days |

`<slug>` — kebab-case, ≤ 40 chars, describes the change. No ticket IDs.
`YYYYMMDD` — date the branch was created.

Examples: `feature/registry-cards-20260709`, `fix/facility-detail-tabs-20260709`, `chore/ai-context-routing-20260709`.

### Worktree location

Root: `../atlasmed-worktrees/` — sibling of the main repo dir. Never nest inside the main repo. One per task.

### Merge

- Squash PR to `main`. Merge commit body summarizes the branch.
- Delete branch after merge — locally AND remotely.
- **All four CI jobs must pass before merge.** GitHub ruleset `Protect main` enforces this.

### Cleanup cadence (weekly)

```bash
git fetch --prune
git worktree prune
git branch --merged main | grep -v '^\* main$' | xargs -r git branch -d
```

Delete `experiment/` branches older than 7 days regardless of merge status.

### Enforcement

- **GitHub:** ruleset `Protect main` — PRs to `main` require passing status checks.
- **Local:** pre-commit + pre-push hooks (install via `bun run prepare`).

## Behavior rules

- Prefer small, focused changes.
- Preserve existing architecture unless explicitly asked to refactor.
- Use existing project patterns before inventing new ones.
- Update nearby docs when behavior changes.
- Do not add dependencies without explaining why.
- Do not touch unrelated files.

## When restructuring documentation

Before creating new AI context files or moving docs, inspect existing `.md` files. For each: keep / refactor / split / merge / archive / delete. Reuse valuable content. Do not blindly preserve stale docs — they poison future AI context.

---

# Domain guides

Each section below covers one app or package. Use these instead of the per-directory AGENTS.md files that previously existed.

---

## apps/api

**Scope:** API routes, use-cases, services, auth, authorization, session management, CNES ingestion pipeline, Temporal workflow triggers from API side, backend validation, DTO mapping.

### Module layout

Each domain module at `apps/api/src/modules/<domain>/`:

```
<domain>/
  application/
    use-cases/
    services/         (optional — cross-use-case orchestration)
  infrastructure/
    routes/           # Elysia routes, one file per resource surface
    repositories/     # Drizzle-backed implementations of ports
    scope/            # (optional) domain-specific scope adapters
  composition.ts      # composition root — wires ports + services + use-cases
  index.ts
  <domain>-http.integration.test.ts
```

Routes import wired use-cases from `../composition`. Never instantiate a repository or use-case in a route file directly.

### Authorization invariants (do not bypass)

1. **CASL via `requirePermission` after `auth`.** Every protected route: `.use(auth).use(requirePermission("<action>", "<SUBJECT>", { resourceIdParam?: "id" }))`.

2. **Resource-scoped grants only when `resourceIdParam` is set.** Omitting it escalates grants to type-level.

3. **`ScopeContext` from `getScope()` for lists and mutations.** Every use-case receives `scope` and enforces territory/facility visibility.

4. **`AccessGrants` (Permission table) merged into CASL and scope.** Exceptional overrides.

5. **`facilityIds` require a real `TerritoryScopePort`.** Do not ship a resource-scoped route without a working port.

6. **Session validity: JWT + session row + tokenVersion.** All three checked on every request.

### Validation (two-layer)

1. Elysia `t.Object(...)` in the route — OpenAPI + basic type checks.
2. Zod `safeParse` via `parseSchema` helper for domain-level validation. Do not skip either layer.

### Error types

- `ValidationError(issues[])` — structured input errors.
- `ResourceNotFoundError(kind, id)` — 404.
- `ForbiddenError()` — thrown by `requirePermission` and use-cases when scope denies a record.

Never throw raw `Error`. Global handler maps typed classes to HTTP; anything else becomes opaque 500.

### OpenAPI

Every route decorates:

```ts
detail: {
  summary: "...",
  tags: ["<Domain>"],
  security: [{ bearerAuth: [] }],
}
```

### Handler discipline

- Handler is thin — extract `body`, `params`, `query`, `scope`. Call the use-case. Return the DTO.
- No inline business logic. No repository calls from the handler.
- Never return raw Drizzle row types. Use-cases return DTOs.

### Testing

- Unit-test use-cases with fake repositories.
- Integration-test routes via Elysia app (`<module>-http.integration.test.ts`).
- Cover: happy path, unauthenticated, unauthorized, scope-denied, validation error.
- See `apps/api/TESTING.md`.

### Observability

Log via shared logger from `packages/observability`. Never `console.log`. Structured JSON with stable action names.

### Anti-patterns

- Do not import from `apps/web` or `apps/mobile`.
- Do not skip `getScope()` "because the query is simple."
- Do not throw raw `Error`.
- Do not instantiate repositories in routes — always go through `composition.ts`.

### Required docs

| Task | Load |
|---|---|
| General API work | `docs/architecture/current.md`, `docs/architecture/target.md` |
| Auth / permissions | this file → `packages/access` section, `docs/architecture/features/access-auth.md` |
| Database change | this file → `packages/database` section |
| CNES / registry ingestion | this file → `packages/cnes-ingestion` + `apps/workers` sections, `docs/architecture/features/clinic-doctor-registry.md` |
| Multi-tenancy | `docs/specs/0001-multi-tenancy/design.md`, `docs/specs/0001-multi-tenancy/tasks.md` |
| Territory logic | `docs/specs/0003-territory-management/requirements.md` |

---

## apps/web

**Scope:** Admin screens (facilities, professionals, territories, users, registry-suggestions), manager/BI dashboards, tables/filters/forms, auth flows (login, 2fa, register, forgot/reset password).

### Stack

Next.js 16 (App Router) + React 19 + Tailwind CSS 4 (zinc palette + blue accent, Inter font) + `iconify-icon` (Solar set) + Radix UI + react-hook-form + zod + axios.

### Conventions

- **Language: Brazilian Portuguese (pt-BR) only.** All UI text (labels, buttons, headings, placeholders, nav, empty/loading states, table headers, dialogs, `aria-label`/`title`, page metadata) MUST be pt-BR. No i18n framework — strings live in-place.
- Dates/numbers use `pt-BR` locale (dd/mm/aaaa). Use `formatDate`/`formatDateTime` helpers in `lib/utils.ts`.
- Design tokens: zinc palette + blue accent + Inter font. No ad-hoc colors.
- Section cards: `rounded-xl border border-zinc-200 bg-white shadow-sm`.
- Loading state: `<div className="py-10 text-center text-sm text-zinc-500">Carregando…</div>`.
- Client components only where interactivity is needed. Do not add `"use client"` speculatively.
- Permission-sensitive UI matches backend authorization. Backend is source of truth.

### Required docs

| Task | Load |
|---|---|
| General web work | this file → `apps/web` section, `apps/web/README.md` |
| Auth screens | this file → `packages/access` section, `docs/architecture/features/access-auth.md` |
| Facility / professional / territory | `docs/architecture/features/clinic-doctor-registry.md`, `docs/specs/0003-territory-management/requirements.md` |
| Registry suggestions | `docs/architecture/features/clinic-doctor-registry.md`, this file → `apps/api` section |
| API-backed feature | `docs/ai/integration-tasks/api-web.md` |
| Multi-tenancy UI | `docs/specs/0001-multi-tenancy/design.md` |

### Anti-patterns

- Do not import Drizzle row types — consume backend DTOs only.
- Do not fetch inside server components with a browser-only axios instance.
- Do not add heavy client-side dependencies (charting libs, map libs) without discussion.

---

## apps/mobile

**Scope:** Mobile UI (screens, widgets), map behavior/route planning/territory rendering, visit logging/geofence/visit forms/history, mobile KPIs, offline sync, background location, GPS/battery handling.

**Stack migration note:** Migration to React Native + Expo is documented in `docs/architecture/adr/0002-mobile-stack.md`. Until then, treat Flutter as active.

### Conventions

- Widgets are small. Split UI, state, and data access into separate files.
- Do not hardcode API response shapes — use shared types from `packages/types` (when available) or mirror explicitly.
- Preserve fast route recalculation and map interaction — profile before adding heavy widgets.
- Handle offline first for visit logging: assume network can fail mid-form.
- Respect GPS/battery: no continuous foreground GPS unless the user is actively navigating.

### Required docs

| Task | Load |
|---|---|
| General mobile work | `docs/architecture/current.md` (mobile section), `docs/architecture/target.md` |
| Map / route / territory | `docs/specs/0003-territory-management/requirements.md` |
| Visit logging | TODO: `docs/product/visits.md` (not yet created) |
| API-backed mobile feature | `docs/ai/integration-tasks/api-mobile.md` |
| Auth / permissions | this file → `packages/access` section, `docs/architecture/features/access-auth.md` |

### Anti-patterns

- Do not import from `apps/api` or `apps/web`.
- Do not couple to database row types — consume backend DTOs only.
- Do not add new native plugins without noting platform impact (iOS + Android build changes).

---

## apps/workers

**Scope:** Temporal workflow workers, registry/CNES ingestion workflows, long-running background jobs orchestrated via Temporal.

### Conventions

- Workflows are deterministic. All I/O goes through activities.
- Activities are idempotent — safe to retry.
- Use versioning/patches when changing workflow logic already running in production.
- Long-running workflows must survive process restarts — do not hold in-memory state.
- Emit structured audit events (see `run_registry_ingestion` pattern) for observability.

### Required docs

| Task | Load |
|---|---|
| General worker work | `docs/architecture/current.md`, `docs/architecture/target.md` |
| CNES ingestion | `docs/architecture/features/clinic-doctor-registry.md`, this file → `packages/cnes-ingestion` section |
| Persistence from workflow | this file → `packages/database` section |
| Workflow triggered by API | this file → `apps/api` section (only the trigger surface) |

### Anti-patterns

- Do not call external services directly from workflow code — only from activities.
- Do not import framework code from `apps/api` unless strictly needed; prefer `packages/*`.
- Do not add Temporal SDK dependencies elsewhere in the monorepo — keep scoped to `apps/workers` and (when necessary) `packages/cnes-ingestion`.

---

## packages/access

**Scope:** Authorization primitives — CASL abilities, roles, permission helpers, row-level visibility, territory-based access, `AccessGrants` overrides.

### Rules

- Backend authorization is the source of truth. Frontend visibility is not security.
- Centralize permission logic here. Do not duplicate CASL rules inside `apps/*`.
- Roles are enum-typed and stable (`ADMIN`, `MANAGER`, `REP`, `OPS`). Adding/renaming a role is breaking — coordinate across `apps/api`, `apps/web`, `apps/mobile` in the same PR.
- Permission helpers: `can<Verb><Noun>` (e.g. `canReadFacilities`).
- `canAccessRoute` — type-level only. `canAccessResource` — resource-level (subject + id + grants). Do not merge.

### Required docs

| Task | Load |
|---|---|
| Any change here | this file → `apps/api` § Authorization invariants, `docs/architecture/features/access-auth.md` |
| Territory visibility | `docs/specs/0003-territory-management/requirements.md` |
| Multi-tenancy | `docs/specs/0001-multi-tenancy/design.md` |

### Anti-patterns

- Do not embed permission rules inside API route handlers — call the helper via `requirePermission`.
- Do not expose CASL primitives directly to frontends; expose derived booleans/helpers.
- Do not silently escalate grants by shipping a resource route without `resourceIdParam`.
- Do not add "debug bypass" flags to skip authorization.

---

## packages/database

**Scope:** Drizzle ORM schema, PostgreSQL migrations (Drizzle Kit), database client factory, PostGIS geometry types, enum type exports.

### Schema layout

| pg schema | Purpose |
|---|---|
| `public` | Core CRM data (users, facilities, territories, etc.) |
| `audit` | `audit_logs` — compliance trail |
| `registry` | Raw CNES source data as-ingested from FTP |
| `ingestion` | Pipeline workflow: `cnes_runs`, `cnes_diffs`, `cnes_suggestions` |

### Migration workflow (MANDATORY)

**Normal changes** (new tables/columns/indexes):

```bash
# 1. Edit schema file(s) in src/schema/
# 2. Generate migration
cd packages/database
DATABASE_URL=<url> bunx drizzle-kit generate --name="<short_description>"
# 3. Review generated SQL in drizzle/<nnnn>_<name>.sql
# 4. Apply
DATABASE_URL=<url> bun run scripts/migrate.ts
# 5. Commit schema + migration together
```

**Ambiguous changes** (renames, type changes, drops — need TTY):

```bash
cd packages/database
DATABASE_URL=<url> bunx drizzle-kit generate --custom --name="<short_description>"
# → empty migration file; fill SQL manually
# Then update snapshot:
DATABASE_URL=<url> bunx drizzle-kit generate --name="<same_name>_snapshot"
```

**Never full reset in production/staging.** Only in local dev for large structural refactors:

```bash
psql $DATABASE_URL -c "DROP SCHEMA IF EXISTS ingestion CASCADE; DROP SCHEMA IF EXISTS audit CASCADE; DROP SCHEMA IF EXISTS registry CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; CREATE EXTENSION IF NOT EXISTS postgis;"
rm -rf packages/database/drizzle
cd packages/database && DATABASE_URL=<url> bunx drizzle-kit generate --name="init"
DATABASE_URL=<url> bun run scripts/migrate.ts
```

### Rules

- Every schema change ships with its migration file in the same commit/PR.
- Never hand-edit `drizzle/meta/*_snapshot.json` unless you know exactly what you're doing.
- Add GiST indexes for geometry columns; B-tree for columns filtered at scale.
- Use `db.transaction(async (tx) => {...})` for multi-step consistency.
- PostGIS columns use `geometryPoint` or `geometryMultiPolygon` from `types/geometry.ts`.
- All DB identifiers (column names, enum names, index names) are `snake_case`.
- Export new enum value types from `src/index.ts` when consumers need them.

### Anti-patterns

- No Prisma — fully on Drizzle.
- No raw unparameterized queries — always use `sql` tagged template.
- No direct ORM type leakage into app DTOs.
- No business logic in this package — infrastructure only.

### Required docs

| Task | Load |
|---|---|
| Migration | this section |
| Territory / PostGIS | `docs/specs/0003-territory-management/requirements.md` |
| Access / row-level | this file → `packages/access` section |

---

## packages/observability

**Scope:** Structured logging, distributed tracing, metrics helpers across `apps/api`, `apps/workers`, and shared packages.

### Rules

- **Console first:** `createLogger()` always writes to stdout/stderr. SigNoz/OTEL is additive.
- **OTEL optional in dev:** `initOpenTelemetry()` no-ops when endpoints are missing.
- Log structured JSON in production (`LOG_FORMAT=json`). Dev defaults to readable output.
- Never log secrets, tokens, or password hashes.
- Trace names describe the operation, not the caller.
- Metrics live in a bounded cardinality set — never include user/request IDs as label values.
- Errors flow through a single reporter with severity + fingerprint.

### Anti-patterns

- Do not `console.log` in service code — use the logger.
- Do not bypass tracing to "make it faster" — profile first.

---

## packages/config

**Scope:** Shared runtime configuration — env parsing, feature flags, per-service defaults.

### Rules

- Env vars validated with Zod at startup. Fail loudly on missing required values.
- No config value baked at build time — everything read at boot.
- No secret defaulting — production requires explicit values.
- Feature flags are typed. No string-keyed lookups.

---

## packages/cnes-ingestion

**Scope:** CNES/DataSUS ingestion adapters — FTP clients, ZIP file mapping, parsing helpers, archive storage, workflow-id helpers.

### Rules

- Adapters implement a port. New sources add an adapter, not new consumers.
- No side effects on import — factory functions build the adapter.
- Parsing is pure. Storage/network is behind adapters.
- FTP timeouts are explicit — never rely on client defaults.

### Required docs

| Task | Load |
|---|---|
| Any change here | `docs/architecture/features/clinic-doctor-registry.md` |
| Workflow orchestration | this file → `apps/workers` section |
| Persistence | this file → `packages/database` section |

### Anti-patterns

- Do not import Temporal SDK code — orchestration lives in `apps/workers`.
- Do not read secrets from `process.env` inside functions; pass configuration explicitly.

---

## packages/mapbox

**Scope:** Mapbox API client wrappers — forward/reverse geocoding, matrix, directions. Shared by `apps/api` (facility geocoding) and potentially `apps/web` and `apps/mobile`.

### Rules

- All Mapbox calls go through this package. Do not `fetch("https://api.mapbox.com/...")` from apps.
- Retry with exponential backoff on 5xx and 429.
- Never log the access token.
- Consumers pass token via factory/env, not a hardcoded global.

---

## packages/ui

**Scope:** Shared UI primitives if used across `apps/web` and future React-based mobile client. Most `apps/web` UI atoms currently live inside `apps/web/components/ui/`.

### Rules

- Only add a component here when at least two apps consume it.
- Component must be styling-token-driven — no `apps/web`-specific palette hardcoding.
- Do not depend on `apps/*`.
- Do not import Radix without verifying the target app already ships it.

### Anti-patterns

- Do not clone `apps/web/components/ui/*` here speculatively.
- Do not create new palette tokens divergent from `apps/web/app/globals.css` — sync them.
