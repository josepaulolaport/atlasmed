---
name: create-endpoint
category: procedure
scope: api
description: Add or modify a backend API route in apps/api using the Elysia + auth + requirePermission + scope-aware use-case MO. Two-layer validation (Elysia t.Object + Zod). Custom error classes. Never bypass auth invariants.
appliesTo:
  concerns: [business-logic, authorization, api-contract, serialization]
autoAttach: manual
combinesWith: [check-permissions, add-tests, keep-docs-current, validate-contract]
conflictsWith: []
---

## Attach when
- Task adds or changes a route file under `apps/api/src/modules/*/infrastructure/routes/*.route.ts`.
- Task adds or changes a use-case exposed by a route.
- Task changes an existing route's request or response shape.

## Load in addition to this skill
- `apps/api/AGENTS.md` (invariants live there — do not violate them).
- `apps/api/src/modules/access/composition.ts` header comment (canonical authorization invariants).
- The nearest existing route file as a shape reference (e.g. `facility/infrastructure/routes/facilities.route.ts`).

## Do (max 10 steps)

1. **Locate module.** Route lives at `apps/api/src/modules/<domain>/infrastructure/routes/<name>.route.ts`. Use-case lives under the same module at `application/use-cases/`.

2. **Compose the route.** Each route is its own `new Elysia()` chain — NEVER share Elysia instances across routes.
   ```ts
   const createFacilityRoute = new Elysia()
     .use(auth)
     .use(requirePermission("create", "FACILITY"))
     .post("/facilities", async ({ body }) => { ... }, { detail, body });
   ```
   Order matters: `auth` before `requirePermission`. `requirePermission` reads `getUser`/`getAccessGrants` from auth's scoped context.

3. **Pick action + subject.** From `@atlasmed/access` `Action` and `Subject` types. For resource-scoped routes, pass `{ resourceIdParam: "id" }`:
   ```ts
   .use(requirePermission("read", "FACILITY", { resourceIdParam: "id" }))
   ```
   Resource-scoped grants only apply when `resourceIdParam` is set — this prevents grant escalation on type-level routes. Never remove this discipline.

4. **Extract scope in handler.** Any list, mutation, or resource read must call `getScope()` and pass `scope` into the use-case:
   ```ts
   const scope = await getScope();
   return facilityUseCases.listFacilities().execute({ ...query, scope });
   ```
   Do NOT bypass scope. `scope.facilityIds` = operational visibility. `scope.analyticsFacilityIds` = manager analytics roll-ups.

5. **Two-layer validation.**
   - Elysia `t.Object(...)` in the route definition for OpenAPI + basic type checks.
   - Zod schemas from `@atlasmed/access` or module-local, parsed via the `parseSchema` helper for domain rules:
     ```ts
     const data = parseSchema(updateFacilityProfessionalSchema, body);
     ```
   `parseSchema` throws `ValidationError` with structured field errors. Do not catch and rethrow generically.

6. **Delegate to use-case.** Handler stays thin — no business logic inline. Use-case is injected via the module's `composition.ts` root:
   ```ts
   import { facilityUseCases } from "../../composition";
   ```

7. **Map to DTO.** Never return raw Prisma models. Use-case returns a DTO; route returns it directly.

8. **Errors are custom classes.** Throw from `apps/api/src/shared/errors`:
   - `ValidationError(issues[])` — input shape / domain validation.
   - `ResourceNotFoundError(kind, id)` — 404 with structured payload.
   - `ForbiddenError()` — thrown by `requirePermission` middleware; use-cases may also throw when scope allows the route but denies a specific record.
   The global error handler maps these to HTTP.

9. **OpenAPI decoration.** Every route needs:
   ```ts
   detail: {
     summary: "...",
     tags: ["<Domain>"],
     security: [{ bearerAuth: [] }],
   }
   ```

10. **Tests.** Unit-test the use-case with fake repositories. Integration-test the route via the Elysia app (see `<module>-http.integration.test.ts` files). Cover: happy path, unauthorized (missing role), scope-denied (role has route access but not this resource), validation error.

## Rules (non-negotiable)

- `.use(auth).use(requirePermission(...))` before the method handler. No exceptions.
- Resource-scoped routes ALWAYS pass `resourceIdParam` — omitting it silently escalates grants.
- Handlers pass `scope` to use-cases. Never query repositories directly from a handler.
- Errors are typed classes. No raw `throw new Error(...)` in routes or use-cases.
- Handlers stay thin — logic lives in use-cases.
- Never `console.log` — use the observability logger.
- Never leak Prisma models — DTOs only.

## Docs to update after

- `apps/api/AGENTS.md` § Authorization invariants — only if a new invariant emerged or an existing one changed.
- `apps/api/src/modules/access/composition.ts` header comment — if the authorization invariant set itself shifted (rare; requires sign-off).
- `docs/architecture/features/<feature>.md` — if a new domain concept emerged.
- Relevant `docs/specs/*/design.md` — if the endpoint fulfills a tracked spec step.
