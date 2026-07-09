# AI Task Router

Worked examples for the six-step task lifecycle from root `AGENTS.md`. Use as templates when classifying a new task.

Each example ends with the exact "Loading:" announcement the AI should output BEFORE editing.

---

## Example 1 — "Add a facility archive endpoint + web button"

**Classify:**
```
domain(s):   [api, web]
procedure(s): [create-endpoint, add-ui-screen]
concerns:    [authorization, data-fetching, state-management, docs, testing]
```

**Cross-boundary → load integration doc first.**

**Loading:**
```
Tier 0: AGENTS.md
Tier 1: docs/ai/integration-tasks/api-web.md
        apps/api/AGENTS.md
        apps/web/AGENTS.md
        packages/access/AGENTS.md          (authorization concern)
Tier 2: skills/procedure/create-endpoint/SKILL.md
        skills/procedure/add-ui-screen/SKILL.md
Tier 3: skills/cross-cutting/check-permissions/SKILL.md
        skills/cross-cutting/keep-docs-current/SKILL.md
```
**Total: 9 files. Under 15-file cross-boundary budget.**

**NOT loaded:** `apps/mobile/*`, `apps/workers/*`, `packages/database/*` (no schema change), `docs/product/*`.

---

## Example 2 — "Restyle the sidebar to add a collapsed state"

**Classify:**
```
domain(s):   [web]
procedure(s): [add-ui-screen]
concerns:    [styling, layout, interaction, state-management]
```

**Single-domain → skip integration doc.**

**Loading:**
```
Tier 0: AGENTS.md
Tier 1: apps/web/AGENTS.md
Tier 2: skills/procedure/add-ui-screen/SKILL.md
Tier 3: skills/cross-cutting/keep-docs-current/SKILL.md
```
**Total: 4 files.**

**NOT loaded:** integration docs, api/mobile/workers AGENTS, product docs, `check-permissions` (no auth concern).

Design tokens (zinc palette + section-card pattern) come from `apps/web/AGENTS.md` § Conventions — not a separate skill.

---

## Example 3 — "Add a Prisma migration for facility.archived_at + backfill"

**Classify:**
```
domain(s):   [shared-package]
procedure(s): [add-migration]
concerns:    [persistence, domain-model, api-contract]
```

**Loading:**
```
Tier 0: AGENTS.md
Tier 1: packages/database/AGENTS.md
Tier 2: skills/procedure/add-migration/SKILL.md
Tier 3: skills/cross-cutting/keep-docs-current/SKILL.md
```
**Total: 4 files.**

**Follow-up:** if backfill volume >1M rows, chain to `procedure/add-workflow` and load `apps/workers/AGENTS.md`.

---

## Example 4 — "Add offline sync for visit logging on mobile"

**Classify:**
```
domain(s):   [mobile]
procedure(s): [add-ui-screen]
concerns:    [offline-first, forms, state-management, data-fetching, error-handling]
```

**Loading:**
```
Tier 0: AGENTS.md
Tier 1: apps/mobile/AGENTS.md
Tier 2: skills/procedure/add-ui-screen/SKILL.md   (repurposable to mobile screen conventions)
Tier 3: skills/cross-cutting/keep-docs-current/SKILL.md
```
**Total: 4 files.**

If the sync surfaces a new API endpoint, escalate to Example 5.

---

## Example 5 — "Sync visits to backend when device reconnects"

**Classify:**
```
domain(s):   [api, mobile]
procedure(s): [create-endpoint, add-ui-screen]
concerns:    [offline-first, business-logic, authorization, api-contract, testing, docs]
```

**Cross-boundary api + mobile → load integration doc.**

**Loading:**
```
Tier 0: AGENTS.md
Tier 1: docs/ai/integration-tasks/api-mobile.md
        apps/api/AGENTS.md
        apps/mobile/AGENTS.md
        packages/access/AGENTS.md         (authorization)
Tier 2: skills/procedure/create-endpoint/SKILL.md
        skills/procedure/add-ui-screen/SKILL.md
Tier 3: skills/cross-cutting/check-permissions/SKILL.md
        skills/cross-cutting/keep-docs-current/SKILL.md
```
**Total: 9 files.**

---

## Example 6 — "Add a CNES ingestion source for another registry (Rio)"

**Classify:**
```
domain(s):   [shared-package, workers]
procedure(s): [add-ingestion, add-workflow]
concerns:    [data-pipeline, integration, business-logic, observability, testing, docs]
```

**Loading:**
```
Tier 0: AGENTS.md
Tier 1: apps/workers/AGENTS.md
        packages/cnes-ingestion/AGENTS.md
        packages/observability/AGENTS.md
Tier 2: skills/procedure/add-ingestion/SKILL.md
        skills/procedure/add-workflow/SKILL.md
Tier 3: skills/cross-cutting/keep-docs-current/SKILL.md
Tier 4: docs/architecture/features/clinic-doctor-registry.md
```
**Total: 8 files.**

---

## Example 7 — "Run the api tests locally after pulling main"

**Classify:**
```
domain(s):   [api]
procedure(s): [run-api-tests]
concerns:    [testing, configuration, persistence]
```

**Loading:**
```
Tier 0: AGENTS.md
Tier 2: skills/procedure/run-api-tests/SKILL.md
```
**Total: 2 files.**

`apps/api/TESTING.md` is a pointer — don't load it directly.

---

## Anti-patterns

- Loading `docs/product/*` for a UI restyle.
- Loading every `apps/*/AGENTS.md` "for context."
- Loading `docs/architecture/adr/*` on routine tasks.
- Loading `docs/implementation/completed.md` (historical only).
- Loading `packages/*/AGENTS.md` when the concern doesn't trigger it.

## Deciding: single-domain or cross-boundary?

- Files edited in ONE app → single-domain.
- Files edited in ≥2 apps OR a shared package → cross-boundary → load integration doc.
- Ambiguous? If the task changes a contract consumed by another app, it's cross-boundary.
