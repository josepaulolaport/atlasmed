# apps/api/AGENTS.md

## Scope

Bun + Elysia backend. Applies when modifying:

- `apps/api/**`
- API routes, use-cases, services
- Authentication, authorization, session management
- CNES / registry ingestion pipeline
- Temporal workflow triggers from API side
- Backend validation, DTO mapping

## Required docs by task

| Task | Load |
|---|---|
| General API work | `docs/architecture/current.md`, `docs/architecture/target.md` |
| Auth / permissions | `packages/access/AGENTS.md`, `docs/architecture/features/access-auth.md` |
| Database change | `packages/database/AGENTS.md` |
| CNES / registry ingestion | `packages/cnes-ingestion/AGENTS.md`, `apps/workers/AGENTS.md`, `docs/architecture/features/clinic-doctor-registry.md` |
| Multi-tenancy | `docs/specs/0001-multi-tenancy/design.md`, `docs/specs/0001-multi-tenancy/tasks.md` |
| Territory logic | `docs/specs/0003-territory-management/requirements.md` |

## Module layout

Each domain module lives at `apps/api/src/modules/<domain>/` with:

```
<domain>/
  application/
    use-cases/
    services/         (optional — cross-use-case orchestration)
  infrastructure/
    routes/           # Elysia routes, one file per resource surface
    repositories/     # Prisma-backed implementations of ports
    scope/            # (optional) domain-specific scope adapters
  composition.ts      # composition root — wires ports + services + use-cases
  index.ts
  <domain>-http.integration.test.ts
```

Routes import wired use-cases from `../composition`. Never instantiate a repository or use-case in a route file directly.

## Authorization invariants (do not bypass)

These come from `apps/api/src/modules/access/composition.ts`. Skills like `procedure/create-endpoint` and `cross-cutting/check-permissions` enforce them. Bypassing any of them is a security regression.

1. **CASL via `requirePermission` after `auth`.** Every protected route:
   ```ts
   .use(auth)
   .use(requirePermission("<action>", "<SUBJECT>", { resourceIdParam?: "id" }))
   ```
   `auth` first, `requirePermission` second. `requirePermission` reads `getUser` and `getAccessGrants` from auth's scoped context.

2. **Resource-scoped grants only when `resourceIdParam` is set.** Omitting it on a resource route silently escalates grants to type-level. Always pass `resourceIdParam` on routes that operate on a single record by id.

3. **`ScopeContext` from `getScope()` for lists and mutations.** Every use-case receives `scope` and enforces territory/facility visibility.
   - `scope.facilityIds` — operational visibility (what the caller can read/mutate).
   - `scope.analyticsFacilityIds` — manager analytics roll-ups.
   Handlers extract `scope` and forward to the use-case. Never bypass.

4. **`AccessGrants` (Permission table) merged into CASL and scope.** Exceptional overrides. Territory / clinic ids from grants extend `facilityIds`. Read handled by `packages/access` — do not duplicate.

5. **`facilityIds` require a real `TerritoryScopePort`.** Some modules stub it and return `[]` until the clinic module provides a real port. Do not ship a resource-scoped route without a working port for its subject.

6. **Session validity: JWT + session row + tokenVersion.** All three checked on every request. Caches revalidate from DB periodically. Do not add a code path that trusts JWT alone.

## Validation

Two-layer:

1. Elysia `t.Object(...)` in the route definition — OpenAPI + basic type checks.
2. Zod `safeParse` via the `parseSchema` helper for domain-level validation. Schemas live in `@atlasmed/access` or module-local files. `parseSchema` throws `ValidationError` with structured field errors.

Do not skip either layer. Do not add ad-hoc `if (!body.x) throw ...` in handlers.

## Errors

Typed classes from `apps/api/src/shared/errors`:

- `ValidationError(issues[])` — structured input errors.
- `ResourceNotFoundError(kind, id)` — 404 with kind + id.
- `ForbiddenError()` — thrown by `requirePermission` and by use-cases when scope denies a specific record.

Never throw raw `Error`. The global error handler maps typed classes to HTTP responses; anything else becomes an opaque 500.

## OpenAPI

Every route decorates:

```ts
detail: {
  summary: "...",
  tags: ["<Domain>"],
  security: [{ bearerAuth: [] }],
}
```

Missing `detail` = missing docs. Missing `security` = looks unauthenticated in Swagger.

## Handler discipline

- Handler is thin. Extract `body`, `params`, `query`, and `scope`. Call the use-case. Return the DTO.
- No inline business logic. No repository calls from the handler.
- Never return raw Prisma models. Use-cases return DTOs.

## Testing

- Unit-test use-cases with fake repositories.
- Integration-test routes via the Elysia app (`<module>-http.integration.test.ts`).
- Cover: happy path, unauthenticated, unauthorized (wrong role), scope-denied (role allowed at route level but not for this record), validation error.
- See `apps/api/TESTING.md`.

## Observability

Log via the shared logger from `packages/observability`. Never `console.log`. Emit structured JSON with a stable action name for auditable events (auth, permission grants, ingestion runs).

## Anti-patterns

- Do not import from `apps/web` or `apps/mobile`.
- Do not reference Next.js or Flutter code.
- Do not add a new dependency without stating why in the PR description.
- Do not skip `getScope()` "because the query is simple."
- Do not throw raw `Error` — the global handler will mask the failure as 500.
- Do not instantiate repositories in routes — always go through `composition.ts`.
