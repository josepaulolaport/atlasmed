---
name: modify-permissions
category: procedure
scope: shared-package
description: Change roles, CASL rules, or row-level visibility in packages/access (and packages/permissions if composed). Backend authorization is source of truth; frontend gates track after.
appliesTo:
  concerns: [authorization, security, api-contract]
autoAttach: manual
combinesWith: [check-permissions, add-tests, keep-docs-current]
conflictsWith: []
---

## Attach when
- Task adds a new role or changes an existing role's abilities.
- Task changes CASL rules or row-level visibility logic.
- Task adds a new `can<Verb><Noun>` helper.

## Do
1. Locate the affected file in `packages/access/` (or `packages/permissions/` for composition).
2. Update CASL abilities or role mapping.
3. If a new helper is exposed, name it `can<Verb><Noun>` and consume role names, not user objects, unless attributes beyond the role are required.
4. Update every consumer (`apps/api` routes, `apps/web` UI gates) in the same PR.
5. Add unit tests for the ability and integration tests for the enforcement path.

## Rules
- Backend is source of truth. Frontend hiding is UX, not security.
- No embedded permission logic in API route handlers — call the helper.
- Do not expose CASL primitives directly to frontends — expose booleans/helpers.
- Adding or renaming a role is a breaking change — coordinate all consumers.

## Docs to update after
- `packages/access/AGENTS.md` — if a new pattern was introduced.
- `docs/architecture/features/access-auth.md` — if the auth surface visibly changed.
- Root `AGENTS.md` § Task lifecycle table — only if concern mapping to `packages/access` changed.
