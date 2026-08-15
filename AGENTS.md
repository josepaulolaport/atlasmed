# AGENTS.md

Canonical AI instruction file for the AtlasMed monorepo. Every AI agent must read this file before editing code or documentation.

## Repository structure

| Path | Tech | Purpose |
|---|---|---|
| `apps/api` | Bun + Elysia | Backend API, Drizzle ORM, PostgreSQL/PostGIS, CASL authorization |
| `apps/mobile` | Flutter | **The product surface.** Shorebird OTA + Fastlane CD — see `apps/mobile/Makefile` |
| `apps/workers/temporal` | Temporal | Background workflows (search-sync, purchase-recurrence, cadastro) — package `@atlasmed/temporal-worker` |
| `packages/database` | Drizzle | Schema, migrations (Drizzle Kit), DB client, PostGIS geometry types |
| `packages/access` | CASL | Authorization rules, roles, row-level access |
| `packages/cnes-ingestion` | basic-ftp | Reads the monthly CNES export over ranged FTP into `registry.*`. Reintroduced narrowed by ADR 0006; worker and join key by ADR 0009 |
| `packages/mapbox` | — | Mapbox API client wrappers (geocoding, directions, matrix) |
| `packages/config` | Zod | Shared runtime config, env parsing, feature flags |
| `packages/observability` | — | Structured logging, distributed tracing, metrics |
| `packages/ui` | — | Shared UI primitives for future cross-client reuse |
| `packages/test-support` | — | Database-backed test harness (`createDbHarness`, `withRollback`, `uniqueAbbreviation`). Each app binds its own `db` in `test-utils/db-harness.ts` |

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
domain(s):   api | mobile | workers | shared-package    (1 or more)
concerns:    authorization | persistence | styling | testing | docs |
             api-contract | background-jobs | offline-first | …
```

### Step 2 — Route

| Trigger | Load |
|---|---|
| Always | this file |
| Single domain | see § Domain guides below for that area's conventions + required docs |
| Cross-boundary (2+ domains) | the domain guide for each affected area, plus the spec that owns the feature |
| Concern involves authorization or security | see § Domain guides → `packages/access` |
| Concern involves persistence or domain model | see § Domain guides → `packages/database` |
| Concern involves background jobs / messaging | see § Domain guides → `apps/workers` |
| Concern involves observability or audit | see § Domain guides → `packages/observability` |
| Concern involves configuration | see § Domain guides → `packages/config` |

This file is the only router. Each domain guide below carries its own "Required docs" table —
there is no second dispatch layer to keep in sync.

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

## Never let a failure become silence

The most expensive defects in this repo have all been the same shape: something
was broken **and reported success**. Not one was found by a failing check.

Three, all confirmed on 2026-08-10:

- **CI ran zero API tests for an unknown period.** `bun --cwd apps/api run test:unit`
  prints `bun run`'s usage text and exits **0** — the flag must follow the
  subcommand. The required `API — typecheck + test` check was green on typecheck
  alone. Found while checking whether a new test had actually executed.
- **A retired service was never removed.** `uc rm atlasmed-web --yes` failed on
  every deploy with `unknown flag: --yes`; a trailing `|| true` swallowed it. The
  service kept running for weeks. Found while reading a deploy log for an
  unrelated reason.
- **Migration `0046` truncated 68 tables with no reseed.** A fresh database
  cannot create a user, because `roles` is never inserted anywhere. Nothing
  fails until someone tries to stand up an environment.

A fourth, confirmed 2026-08-14:

- **Database-backed tests skip themselves when there is no database.** Both
  harnesses probe the connection and `describe.if(dbUp)` the suite, so a machine
  without `apps/api/.env.test` runs *zero* of them and still prints `0 fail`.
  `apps/api/src/test-env-loader.ts` deletes any ambient `DATABASE_URL` (a good
  guard — it stops `bun test` reaching a real database) and falls back to port
  5432, while local Postgres here runs on **5434**. CI supplies its own database,
  so CI is green and every local run is quietly hollow. Copy
  `apps/api/.env.test.example`; for `apps/workers/temporal`, pass `DATABASE_URL`
  explicitly. **Check the file count**, not the pass count: a suite that "ran"
  fewer files than it has is the tell.

The lesson is not "be careful". It is that **a guard which converts failure into
silence is worse than no guard**, because it also removes the evidence.

Concretely, when writing or reviewing anything in the deploy or CI path:

- `|| true`, `continue-on-error`, `--no-exit-on-error` and empty `catch` blocks
  must **log what they suppressed**. Tolerating failure is often right; hiding
  which failure never is.
- A command that "succeeds" is not evidence it did anything. Check the output.
  `exit 0` from a CLI that printed its help text is the canonical trap.
- Prefer a command that fails loudly and is made idempotent over one wrapped in
  `|| true` to make it re-runnable.
- After changing a migration, deploy step or CI invocation, **read the log of the
  first real run** and confirm the thing you expected to happen appears in it.
  Green is not evidence.

## When restructuring documentation

Before creating new AI context files or moving docs, inspect existing `.md` files. For each: keep / refactor / split / merge / archive / delete. Reuse valuable content. Do not blindly preserve stale docs — they poison future AI context.

---

# Domain guides

Each section below covers one app or package. Use these instead of the per-directory AGENTS.md files that previously existed.

---

## apps/api

**Scope:** API routes, use-cases, services, auth, authorization, session management, Temporal workflow triggers (search-sync / purchase-recurrence / cadastro — not CNES ingest), backend validation, DTO mapping. CNES registry warehouse READ/confirm removed with the `registry` / `ingestion` schemas.

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

4. **`facilityIds` require a real `TerritoryScopePort`.** Do not ship a resource-scoped route without a working port.

5. **Session validity: JWT + session row + tokenVersion.** All three checked on every request.

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
- Route security is machine-audited by `apps/api/src/test-utils/route-security.manifest.ts` and scope enforcement by `scope-enforcement.manifest.ts`. Add new routes/use-cases to those manifests.
- `*.db.test.ts` needs `apps/api/.env.test` — copy `.env.test.example`. Without it they **skip silently** and a green run proves nothing (see "Never let a failure become silence").

### Observability

Log via shared logger from `packages/observability`. Never `console.log`. Structured JSON with stable action names.

### Anti-patterns

- Do not import from other apps.
- Do not skip `getScope()` "because the query is simple."
- Do not throw raw `Error`.
- Do not instantiate repositories in routes — always go through `composition.ts`.

### Required docs

| Task | Load |
|---|---|
| General API work | `docs/architecture/current.md` |
| Auth / permissions | this file → `packages/access` section, `docs/architecture/features/access-auth.md` |
| Database change | this file → `packages/database` section |
| CNES / registry | `docs/architecture/adr/0009-cnes-ingestion-worker-and-join-key.md`, `docs/architecture/adr/0006-cnes-registry-reintroduction.md`, `docs/specs/0012-cnes-registry-professional-associations/requirements.md` |
| Territory / clinic ownership | `docs/specs/0009-territory-clinic-ownership/requirements.md` |
| Verticals / facility profiles | `docs/specs/0010-verticals-and-profiles/requirements.md` |
| Cadastro | `docs/specs/0011-cadastro-pipeline/requirements.md` |
| Products / potencial de mercado | `docs/specs/0013-potencial-de-mercado/requirements.md` |
| Dashboards / team | `docs/specs/0014-desempenho-e-equipe/requirements.md` |

---

## apps/web — REMOVED

The Next.js admin app was **deleted**. All product surfaces are mobile: admin and manager
features that would conventionally be web — team management, performance dashboards, catalog and
potential admin, entity CRUDs — go in `apps/mobile`.

It was abandoned first (2026-08-09) and removed shortly after. By then several of its pages
called endpoints deleted in the `a3e32ac5` cutover and 404'd at runtime, and it had zero tests.
Do not resurrect it, and do not plan work against it.

---

## apps/mobile

**Scope:** Mobile UI (screens, widgets), map behavior/route planning/territory rendering, visit logging/geofence/visit forms/history, mobile KPIs, offline sync, background location, GPS/battery handling.

**Stack migration note:** Migration to React Native + Expo is documented in `docs/architecture/adr/0002-mobile-stack.md`. Until then, treat Flutter as active.

### Build & CD tooling

| Tool | Propósito | Config |
|---|---|---|
| **Shorebird** | Over-the-air updates + release builds (Android AAB, iOS IPA) | `shorebird.yaml` (app ID), `shorebird-patches.json` (patch manifest) |
| **Cider** | Version management (semver + build number) + CHANGELOG | CLI-only, ativado on-demand no CI |
| **Makefile** | Orchestração de build: `make android`, `make ios`, `make patch-release`, `make web` | `apps/mobile/Makefile` — targets documentados |
| **Fastlane** | Upload de artefatos ao Google Play internal e TestFlight | `fastlane/Fastfile`, `fastlane/Appfile`, `Gemfile` |
| **FVM** | Flutter SDK version pinning | `.fvmrc` — `3.44.1` |

### Release workflow (GitHub Actions — `deploy-mobile-main.yml`)

Cada push ao `main` com mudanças em `apps/mobile/` dispara; também é possível executar manualmente com `workflow_dispatch` (`store|patch`, `dry_run=true` por padrão):

1. **Resolve mode** — decide se é `store` (release completa) ou `patch` (OTA)
   - execução manual usa o modo escolhido
   - push usa `store` se houver label `release/store` ou mudanças em android/, ios/, pubspec.yaml, shorebird.yaml ou config.production.json
   - fallback seguro para `store` quando o manifest está vazio
2. **Setup** — Flutter analyze + test (compartilhado entre os modos)
3. **Store mode** (macOS):
   - `cider bump minor --bump-build` apenas em deploy real
   - instala upload keystore Android, service account Google Play, certificado Apple Distribution e provisioning profile
   - `shorebird release android` → AAB → Fastlane → Google Play internal
   - `shorebird release ios` → IPA → Fastlane → TestFlight
   - dry-run compila sem publicar, alterar versão ou fazer commit
4. **Patch mode** (macOS):
   - não altera a versão: cada entrada do manifest aponta para uma release Shorebird existente
   - `shorebird patch` para cada entrada Android/iOS no manifest
   - dry-run adiciona `--dry-run` e não publica patches
5. **Web deploy** (Firebase Hosting) continua em paralelo via `deploy-production.yml`

### Conventions

- Widgets are small. Split UI, state, and data access into separate files.
- Do not hardcode API response shapes — use shared types from `packages/types` (when available) or mirror explicitly.
- Preserve fast route recalculation and map interaction — profile before adding heavy widgets.
- Handle offline first for visit logging: assume network can fail mid-form.
- Respect GPS/battery: no continuous foreground GPS unless the user is actively navigating.
- Version é gerenciada pelo Cider, nunca editada manualmente no `pubspec.yaml`.
- `CHANGELOG.md`: títulos de versão no formato `## <versão> - <data>`, sem colchetes, e mudanças pendentes sob `## Unreleased`. O Cider identifica releases por esse padrão; com colchetes ele não reconhece versão alguma, escapa os títulos existentes e grava a nova seção no fim do arquivo — silenciosamente, com exit 0, num passo do CI que só commita o resultado.
- Patches Shorebird são declarativos: adicione ao `shorebird-patches.json` e o CI aplica.
- `config.production.json` NÃO é versionado — materializado no CI via `CONFIG_PRODUCTION_JSON_BASE64`.
- Flutter SDK version pinned via FVM (`.fvmrc`).
- Android signing config deve ser configurada via `android/key.properties` (não versionado).

### Required docs

| Task | Load |
|---|---|
| General mobile work | `docs/architecture/current.md` (mobile section) |
| Map / route / territory | `docs/specs/0009-territory-clinic-ownership/requirements.md` |
| Verticals / linha switching | `docs/specs/0010-verticals-and-profiles/requirements.md` |
| Cadastro screens | `docs/specs/0011-cadastro-pipeline/requirements.md` |
| Potencial de mercado | `docs/specs/0013-potencial-de-mercado/requirements.md` |
| Desempenho / Equipe | `docs/specs/0014-desempenho-e-equipe/requirements.md` |
| API-backed mobile feature | this file → `apps/api` section (contract + DTO discipline) |
| Auth / permissions | this file → `packages/access` section, `docs/architecture/features/access-auth.md` |
| **Build / CD / Shorebird** | `apps/mobile/Makefile`, `apps/mobile/scripts/resolve-shorebird-patches.sh`, `.github/workflows/deploy-mobile-main.yml` |

### Anti-patterns

- Do not import from other apps.
- Do not couple to database row types — consume backend DTOs only.
- Do not add new native plugins without noting platform impact (iOS + Android build changes).
- Do not edit version manualmente em `pubspec.yaml` — use `make bump-minor` ou `make bump-patch`.
- Do not pular o setup do Shorebird — toda mudança em android/ ou ios/ exige store release.

---

## apps/workers

**Scope:** Temporal workflow workers in `apps/workers/temporal` (`@atlasmed/temporal-worker`) — search-sync, purchase-recurrence, cadastro-file. Task queue default: `atlasmed-workflows`.

### Conventions

- Workflows are deterministic. All I/O goes through activities.
- Activities are idempotent — safe to retry.
- Use versioning/patches when changing workflow logic already running in production.
- Long-running workflows must survive process restarts — do not hold in-memory state.
- Emit structured audit events for observability.

### Required docs

| Task | Load |
|---|---|
| General worker work | `docs/architecture/current.md` |
| CNES | ADR `0009-cnes-ingestion-worker-and-join-key.md` first, then ADR 0006 — 0009 supersedes it on the worker, the `ingestion` ledger and the join key |
| Emultec order import | `docs/ops/emultec-order-import.md` |
| Persistence from workflow | this file → `packages/database` section |
| Workflow triggered by API | this file → `apps/api` section (only the trigger surface) |

### Anti-patterns

- Do not call external services directly from workflow code — only from activities.
- Do not import framework code from `apps/api` unless strictly needed; prefer `packages/*`.
- Do not add Temporal SDK dependencies elsewhere in the monorepo — keep scoped to `apps/workers/*`.

---

## packages/access

**Scope:** Authorization primitives — CASL abilities, roles, permission helpers, row-level visibility, territory-based access.

### Rules

- Backend authorization is the source of truth. Frontend visibility is not security.
- Centralize permission logic here. Do not duplicate CASL rules inside `apps/*`.
- Roles are enum-typed and stable (`ADMIN`, `MANAGER`, `REP`, `OPS`). Adding/renaming a role is breaking — coordinate across every active consumer in the same PR.
- Permission helpers: `can<Verb><Noun>` (e.g. `canReadFacilities`).
- `canAccessRoute` — type-level only. `canAccessResource` — resource-level (subject + id + grants). Do not merge.

### Required docs

| Task | Load |
|---|---|
| Any change here | this file → `apps/api` § Authorization invariants, `docs/architecture/features/access-auth.md` |
| Territory visibility | `docs/specs/0009-territory-clinic-ownership/requirements.md` |
| Verticals / profile scoping | `docs/specs/0010-verticals-and-profiles/requirements.md` |

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
| `public` | Core CRM data (users, facilities, territories, CNES lookup tables, etc.) |
| `audit` | `audit_logs` — compliance trail |

### Migration workflow (MANDATORY)

AtlasMed uses Drizzle Kit with a **branch-friendly** flow: prefer **generate + migrate** always for DBs that hold CRM data; optional `push` only on **empty disposable local** DBs. Shared environments use SQL migrations only.

Commands run from `packages/database` unless noted. Prefer `bun run db:migrate` and `bunx drizzle-kit generate` (repo scripts).

#### HARD SAFETY — data loss (incident 2026-07-26)

**Cause:** `bunx drizzle-kit push --force` against populated local DB `atlasmed-3` auto-accepted destructive DDL and emptied `facilities` / `territories` / `facility_vertical_profiles` (relation files rewritten ~01:21). Orphan child rows (e.g. `facility_healthcare_provider_shares`) survived.

**Never:**

- Run `drizzle-kit push` (or `db:push`) against a DB that has facilities/users/professionals/territories data.
- Pass `--force` to push (auto-truncates / accepts data-loss statements).
- Point push at staging, production, or any non-local host.
- AI agents: do **not** invent `push --force` workarounds. If schema must change on a populated DB → `generate` (custom if needed) + `db:migrate` only.

**Enforced by** `packages/database/scripts/db-push.ts` (`bun run db:push` from `@atlasmed/database` or `@atlasmed/api`):

| Gate | Requirement |
|---|---|
| Opt-in | `ATLASMED_ALLOW_DB_PUSH=1` |
| Local host only | `localhost` / `127.0.0.1` / `::1` / `*.local` |
| Disposable DB name only | `atlasmed_test` \| `atlasmed_scratch` \| `atlasmed_empty` — **no override** (blocks `atlasmed-3` forever) |
| Populated CRM tables | refused unless `ATLASMED_ALLOW_DATA_LOSS=1` |
| `--force` | refused unless `ATLASMED_ALLOW_DB_PUSH_FORCE=1` **and** `ATLASMED_ALLOW_DATA_LOSS=1` |

Calling bare `bunx drizzle-kit push` bypasses the wrapper — **forbidden**. Always `bun run db:push`. Apps must not wire bare `drizzle-kit push` in package scripts.

#### 1. Local prototyping — prefer migrate; push only on empty DBs

Generating a `.sql` + snapshot on every schema tweak clutters `drizzle/`, worsens merge conflicts, and risks out-of-order journal `when` timestamps.

**Preferred on a DB with seed/CRM data:**

```bash
cd packages/database
# edit schema TS
DATABASE_URL=<url> bunx drizzle-kit generate --name="<short>"   # or --custom when backfill needed
DATABASE_URL=<url> bun run db:migrate
bunx drizzle-kit check
```

**Optional push** only when the target DB is empty/disposable:

```bash
cd packages/database
ATLASMED_ALLOW_DB_PUSH=1 DATABASE_URL=postgresql://postgres:postgres@localhost:5432/atlasmed_scratch bun run db:push
```

Optional but recommended: Neon (or similar) **database branch** per git feature branch so schema experiments stay isolated — still prefer migrate over push.

#### 2. Before opening / merging the PR — generate **once**

When the schema change is final and the branch is rebased onto latest `main`:

```bash
git fetch origin main && git rebase origin/main   # or merge main
cd packages/database
DATABASE_URL=<local-url> bunx drizzle-kit generate --name="<short_description>"
# Review drizzle/<nnnn>_<name>.sql and meta snapshots
DATABASE_URL=<local-url> bun run db:migrate       # apply via migrator (not push)
bunx drizzle-kit check                            # commutativity / race check
```

Commit **schema + generated migration + meta** together. One logical schema change ⇒ one migration on the PR whenever possible.

Deploy / CI apply migrations with `bun run db:migrate` only (see deploy workflows). Do not generate or push in production pipelines.

#### 3. Multi-branch collaboration — `drizzle-kit check`

When two branches each generate migrations, journal order / snapshots can conflict. After pulling or merging `main` into a schema branch:

```bash
cd packages/database
bunx drizzle-kit check
```

Drizzle walks migration history (snapshot DAG / journal) and reports whether parallel migrations are **commutative** (safe in either order, e.g. columns on different tables) or **conflicting** (same table/column altered on both sides).

| Result | Action |
|---|---|
| Pass | Continue; merge as usual |
| Fail (non-commutative) | Delete **your feature branch’s** generated migration SQL + its meta snapshot entries that are not on `main`, rebase onto `main`, then `drizzle-kit generate` again so your migration appends cleanly |

Do **not** hand-edit `_journal.json` `when` values or snapshot graphs to “force” order. The runtime migrator applies a migration only when `folderMillis` (`when`) is greater than the latest applied `created_at` — an out-of-order `when` skips that migration and breaks deploy (seen with `0013` vs `0012`).

#### 4. Ambiguous DDL (renames, type changes, drops)

```bash
cd packages/database
DATABASE_URL=<local-url> bunx drizzle-kit generate --custom --name="<short_description>"
# Fill the empty SQL file carefully
DATABASE_URL=<local-url> bunx drizzle-kit generate --name="<same_name>_snapshot"
```

#### 5. Broken migration folder after a bad merge

If git merge leaves orphaned `.sql` files or corrupt meta:

1. Reset `packages/database/drizzle/` migration artifacts that are not on `main` (keep `main`’s history).
2. Restore a clean schema TS that matches intended end state.
3. Rebase onto `main`, then `bunx drizzle-kit generate` + `bunx drizzle-kit check`.

Do not invent journal rows or rewrite snapshots by hand.

#### 6. Local full reset (dev only — never staging/production)

```bash
psql $DATABASE_URL -c "DROP SCHEMA IF EXISTS ingestion CASCADE; DROP SCHEMA IF EXISTS audit CASCADE; DROP SCHEMA IF EXISTS registry CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; CREATE EXTENSION IF NOT EXISTS postgis;"
# Then either: migrate from existing drizzle/ history, or (rare, coordinated) regenerate history — do not rewrite shared migration history casually
DATABASE_URL=<url> bun run db:migrate
```

### Rules

- Ship schema change + generated migration + meta in the same PR.
- Local iteration on valued data: `generate` + `migrate`. Empty disposable local only: gated `db:push`.
- Run `drizzle-kit check` before merge when the branch touches `packages/database/drizzle/`.
- **Never manually edit** `packages/database/drizzle/*` (SQL, snapshots, `_journal.json`) except filling a `--custom` migration’s empty SQL file. Everything else is generated exclusively by `drizzle-kit generate`.
- Never hand-edit journal `when` / hashes to unstick deploy — regenerate or follow §3 conflict resolution.
- Add GiST indexes for geometry columns; B-tree for columns filtered at scale.
- Use `db.transaction(async (tx) => {...})` for multi-step consistency.
- PostGIS columns use `geometryPoint` or `geometryMultiPolygon` from `types/geometry.ts`.
- All DB identifiers (column names, enum names, index names) are `snake_case`.
- Export new enum value types from `src/index.ts` when consumers need them.

### Anti-patterns

- No Prisma — fully on Drizzle.
- No `drizzle-kit push` / `db:push` to staging/production/non-local hosts.
- No `drizzle-kit push` against non-disposable DB names (`atlasmed-3`, Neon branches used as CRM, etc.).
- No `drizzle-kit push --force` (or any auto-accept data-loss flag) against populated DBs.
- No bare `bunx drizzle-kit push` bypassing `bun run db:push` (including in app `package.json` scripts).
- No generating a migration per tiny local schema tweak on a long-lived feature branch.
- No raw unparameterized queries — always use `sql` tagged template.
- No direct ORM type leakage into app DTOs.
- No business logic in this package — infrastructure only.

### Required docs

| Task | Load |
|---|---|
| Migration | this section |
| Territory / PostGIS | `docs/specs/0009-territory-clinic-ownership/requirements.md` |
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

- `@atlasmed/config` is the single source of truth for environment variables. Apps and packages that need env values import `environment` from this package instead of reading `process.env` directly.
- Env vars are validated with TypeBox. Production validation runs through the root `bun run env:check`, which delegates to the only workspace-level `env:check` script in `@atlasmed/config`.
- No config value baked at build time unless explicitly designated as public client configuration.
- No secret defaulting — production requires explicit values.
- Feature flags are typed. No string-keyed lookups.

---

## CNES — a narrow registry, loaded by a monthly worker

The original ingest vertical was deleted in `a3e32ac5`: FTP/archive/Temporal monthly ingest, the
registry warehouse READ/confirm surface, and Postgres schemas `registry` / `ingestion`. **The
weight that got it deleted stays deleted** — see the out-of-scope list below.

**ADR 0006** reintroduced a deliberately narrower `registry` schema, used to suggest which
professionals CNES associates with a clinic. **ADR 0009** then widened it on evidence:

- The load is a **Temporal worker**, not a manual script, and it reads the export **over ranged
  FTP without downloading it** — the archive is 725 MB and 2.87 GB extracted, and only the six
  entries it needs are fetched.
- **`ingestion` is back, as one table.** `cnes_runs` is a run ledger. The diff and suggestion
  tables are not coming back.
- The professional join key is **one column**, measured at 100 % coverage on the real export:
  `registry.professionals.cnes_id` = `person_healthcare_profiles.cnes_professional_id`. ADR 0006
  guessed that column was dead weight; it is the key.
- A user may **import a doctor** CNES lists at their clinic, creating a `public` person from
  registry data after confirming it (spec 0012 §5).

Still out of scope: archive storage · diff/suggestion tables · a suggestion review surface · a
`/registry/*` API module · **automated** write-back from `registry` to `public` · national-scale
registry data.

Widening that boundary needs a new ADR.

**Also in repo:** public CNES lookup tables, `facilities.cnes_code`,
`person_healthcare_profiles.cnes_professional_id`, Spec 0007 `field_suggestions`, Temporal worker
at `apps/workers/temporal` (`@atlasmed/temporal-worker`, queue `atlasmed-workflows`).

---

## packages/mapbox

**Scope:** Mapbox API client wrappers — forward/reverse geocoding, matrix, directions. Shared by `apps/api` (facility geocoding) and potentially `apps/mobile`.

### Rules

- All Mapbox calls go through this package. Do not `fetch("https://api.mapbox.com/...")` from apps.
- Retry with exponential backoff on 5xx and 429.
- Never log the access token.
- Consumers pass token via factory/env, not a hardcoded global.

---
