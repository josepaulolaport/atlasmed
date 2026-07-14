# packages/access/AGENTS.md

## Scope

Authorization primitives: CASL abilities, roles, permission helpers, row-level visibility, territory-based access, `AccessGrants` overrides.

## Authorization invariants

The canonical invariants are enforced in `apps/api/src/modules/access/`. This package supplies the primitives (`canAccessRoute`, `canAccessResource`, ability definitions, role/subject/action types, grant record shape) that the API composition uses.

See `apps/api/AGENTS.md` § Authorization invariants for the enforced runtime contract:

1. CASL via `requirePermission` after `auth`.
2. Resource-scoped grants only when `resourceIdParam` is set.
3. `ScopeContext` via `getScope()` for lists and mutations.
4. `AccessGrants` merged into CASL and scope.
5. `facilityIds` require a real `TerritoryScopePort`.
6. Session validity: JWT + session row + tokenVersion.

Any change here must remain compatible with those invariants.

## Rules

- Backend authorization is the source of truth. Frontend visibility is not security.
- Centralize permission logic here. Do not duplicate CASL rules inside `apps/*`.
- Roles are enum-typed and stable (`ADMIN`, `MANAGER`, etc.). Adding or renaming a role is a breaking change — coordinate with `apps/api`, `apps/web`, `apps/mobile` in the same PR.
- Permission helpers are named `can<Verb><Noun>` (e.g. `canReadFacilities`, `canManageTerritories`). Prefer consuming role names, not user objects, unless the check requires attributes beyond the role.
- `canAccessRoute` — type-level (subject only). `canAccessResource` — resource-level (subject + id + grants). Do not merge the two into a single helper.

## Required docs by task

| Task | Load |
|---|---|
| Any change here | this file, `apps/api/AGENTS.md` § Authorization invariants, `docs/architecture/features/access-auth.md` |
| Territory visibility | `docs/specs/0003-territory-management/requirements.md` |
| Multi-tenancy | `docs/specs/0001-multi-tenancy/design.md` |

## Anti-patterns

- Do not embed permission rules inside API route handlers — call the helper via `requirePermission`.
- Do not expose CASL primitives directly to frontends; expose derived booleans/helpers.
- Do not silently escalate grants by shipping a resource route without `resourceIdParam`.
- Do not add "debug bypass" flags to skip authorization.
