# Fullstack Feature Integration

Use when a feature spans `apps/api` + (`apps/web` OR `apps/mobile`) + at least one shared package (schema, permissions, shared types). Highest-scope integration doc.

## Load

**Always:**
- `AGENTS.md`
- `docs/ai/integration-tasks/api-web.md` OR `docs/ai/integration-tasks/api-mobile.md` (pick the frontend side)
- Affected app `AGENTS.md` files — do NOT load unrelated apps

**Conditional:**

| Concern | Load |
|---|---|
| authorization / security | `AGENTS.md` § `packages/access` |
| persistence / domain model | `AGENTS.md` § `packages/database` |
| background jobs / messaging | `AGENTS.md` § `apps/workers` |
| observability / audit | `AGENTS.md` § `packages/observability` |
| Feature-domain | Relevant `docs/architecture/features/*.md` or `docs/specs/*/design.md` |
| testing (api-side) | `apps/api/TESTING.md` |

## Work order

1. Identify every affected app and package BEFORE editing. Announce the list.
2. Define API contract first.
3. Update shared types / place DTOs in a shared location.
4. Schema change: `push` locally while iterating; `generate` once before PR; `migrate` + `drizzle-kit check` (see `AGENTS.md` § Migration workflow).
5. Backend: validation → authorization → use-case → DTO mapping → tests.
6. Permissions: helper in `packages/access` if reused; enforce at API boundary.
7. Frontend: fetch → state → UI → loading/empty/error states.
8. Observability + audit for permission-sensitive events.
9. Verify permissions end-to-end.
10. Update matching AGENTS.md / docs in same PR if conventions shifted.

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
