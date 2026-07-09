---
name: check-permissions
category: cross-cutting
description: Verify authorization is enforced at the backend boundary via auth + requirePermission middleware + scope, and that frontend gates match. Attaches on authorization or security concerns.
appliesTo:
  concerns: [authorization, security]
autoAttach: on-concern-match
combinesWith: [modify-permissions, create-endpoint]
conflictsWith: []
---

## Attach when
- Task adds/changes a route or use-case that reads or mutates user-scoped data.
- Task adds/changes a UI gate visible to more than one role.
- Task changes any file under `packages/access` or `apps/api/src/modules/access`.

## Load in addition
- `apps/api/AGENTS.md` § Authorization invariants
- `apps/api/src/modules/access/composition.ts` (header comment — canonical invariants)
- `packages/access/AGENTS.md`
- `docs/architecture/features/access-auth.md`

## Do

1. **Identify the action and subject.** From `@atlasmed/access` `Action` and `Subject` types. Actions: `create | read | update | delete | manage`. Subjects: `FACILITY | PROFESSIONAL | TERRITORY | USER | …` (see `@atlasmed/access` source).

2. **Route-level check** — Elysia routes use `requirePermission`:
   ```ts
   .use(auth)
   .use(requirePermission("read", "FACILITY", { resourceIdParam: "id" }))
   ```
   - `auth` first, `requirePermission` second.
   - `resourceIdParam` MANDATORY for routes operating on a single record — omitting it silently escalates grants to type-level (see `permission.middleware.ts:79-88`).

3. **Handler-level scope** — every list, mutation, or resource read:
   ```ts
   const scope = await getScope();
   return useCase.execute({ ..., scope });
   ```
   `scope.facilityIds` = operational visibility. `scope.analyticsFacilityIds` = manager analytics roll-ups. Never bypass, even for "simple" queries.

4. **Use-case scope enforcement.** Use-case receives `scope` and filters queries by `facilityIds` (or equivalent for the domain). If a specific record is denied by scope, throw `ForbiddenError` — do NOT return an empty result.

5. **AccessGrants overrides.** Exceptional permissions (per-territory, per-clinic) merged into CASL and scope automatically via `packages/access`. Do not duplicate this logic in modules — call the helper.

6. **Frontend gates match backend.** In `apps/web`, hide/disable UI for roles that fail the check. Never trust hide-only for security — backend must still enforce.

7. **Audit the sensitive event.** For auth grants, role changes, permission-sensitive mutations: emit an audit event via the observability logger with a stable action name.

8. **Tests cover the enforcement path.**
   - Unauthenticated → 401.
   - Wrong role → 403 (`ForbiddenError`).
   - Right role, wrong scope → 403 or empty result depending on semantics.
   - Right role, right scope → 200 with expected DTO.
   Integration tests live in `<module>-http.integration.test.ts`.

## Rules (non-negotiable)

- Backend is source of truth. Frontend gates are UX only.
- Never embed permission logic in route handlers — call the `can<Verb><Noun>` helper via `requirePermission` middleware.
- Never trust request-body-supplied `userId` or `roleId`.
- Session validity requires JWT + session row + tokenVersion — do not short-circuit any of the three.
- Do not read the raw `Authorization` header in a handler — the `auth` plugin already parsed and validated it.
- Never log tokens, secrets, or password hashes in audit events.

## Docs to update after

- `apps/api/AGENTS.md` § Authorization invariants — if a new invariant was introduced.
- `apps/api/src/modules/access/composition.ts` header comment — if the invariant set itself shifted (rare).
- `packages/access/AGENTS.md` — if new roles / abilities / helpers were added.
- `docs/architecture/features/access-auth.md` — if the auth surface visibly changed.
