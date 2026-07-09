# Fullstack Feature Integration

Use when a feature spans `apps/api` + (`apps/web` OR `apps/mobile`) + at least one shared package (schema, permissions, shared types). Highest-scope integration doc.

## Load

**Always:**
- `AGENTS.md`
- `docs/ai/integration-tasks/api-web.md` OR `docs/ai/integration-tasks/api-mobile.md` (pick the frontend side)
- Affected app `AGENTS.md` files — do NOT load unrelated apps
- `skills/cross-cutting/keep-docs-current/SKILL.md`

**Procedure skills (pick applicable):**
- `skills/procedure/create-endpoint/SKILL.md`
- `skills/procedure/add-migration/SKILL.md`
- `skills/procedure/add-ui-screen/SKILL.md`
- `skills/procedure/modify-permissions/SKILL.md`
- `skills/procedure/add-workflow/SKILL.md` (if background jobs)
- `skills/procedure/add-ingestion/SKILL.md` (if data pipeline)

**Conditional:**

| Concern | Load |
|---|---|
| `authorization`, `security` | `packages/access/AGENTS.md`, `skills/cross-cutting/check-permissions/SKILL.md` |
| `persistence`, `domain-model` | `packages/database/AGENTS.md` |
| `background-jobs`, `messaging` | `apps/workers/AGENTS.md`, `skills/procedure/add-workflow/SKILL.md` |
| `observability`, `audit` | `packages/observability/AGENTS.md` |
| Feature-domain | Relevant `docs/architecture/features/*.md` or `docs/specs/*/design.md` |
| `testing` (api-side) | `skills/procedure/run-api-tests/SKILL.md` |

## Work order

1. Identify every affected app and package BEFORE editing. Announce the list.
2. Define API contract first.
3. Update shared types / place DTOs in a shared location.
4. Schema change → migration → generate client → commit generated files.
5. Backend: validation → authorization → use-case → DTO mapping → tests.
6. Permissions: helper in `packages/access` if reused; enforce at API boundary.
7. Frontend: fetch → state → UI → loading/empty/error states.
8. Observability + audit for permission-sensitive events.
9. Verify permissions end-to-end.
10. Run `keep-docs-current`.

## Rules

- Budget: ≤ 15 files. Prune before starting if over.
- Do NOT load unrelated app docs.
- Do NOT implement frontend assumptions before backend contract is defined.
- Do NOT duplicate authorization logic across apps.
- Keep shared contracts in a shared location, not inline.
- Split the work into small commits: schema → shared types → backend → permissions → frontend → tests → docs.

## Docs to update after

- Every affected AGENTS.md.
- `docs/architecture/features/<feature>.md` — if a new domain concept emerged.
- Relevant `docs/specs/*/design.md` — if the feature is tracked by a spec.
