# AI Task Router

Worked examples for the task lifecycle from root `AGENTS.md`. Use as templates when classifying a new task.

Each example ends with the exact "Loading:" announcement the AI should output BEFORE editing.

---

## Example 1 — "Add a facility archive endpoint + web button"

**Classify:**
```
domain(s):  [api, web]
concerns:   [authorization, data-fetching, state-management, docs, testing, api-contract]
```

**Cross-boundary → load integration doc first.**

**Loading:**
```
Tier 0: AGENTS.md
Tier 1: docs/ai/integration-tasks/api-web.md
        apps/api/AGENTS.md
        apps/web/AGENTS.md
        packages/access/AGENTS.md          (authorization concern)
```
**Total: 5 files.**

**NOT loaded:** `apps/mobile/*`, `apps/workers/*`, `packages/database/*` (no schema change), `docs/product/*`.

---

## Example 2 — "Restyle the sidebar to add a collapsed state"

**Classify:**
```
domain(s):  [web]
concerns:   [styling, layout, interaction, state-management]
```

**Single-domain → skip integration doc.**

**Loading:**
```
Tier 0: AGENTS.md
Tier 1: apps/web/AGENTS.md
```
**Total: 2 files.**

Design tokens (zinc palette + section-card pattern) come from `apps/web/AGENTS.md` § Conventions.

---

## Example 3 — "Add a Drizzle migration for facility.archived_at + backfill"

**Classify:**
```
domain(s):  [shared-package]
concerns:   [persistence, domain-model, api-contract]
```

**Loading:**
```
Tier 0: AGENTS.md
Tier 1: AGENTS.md § packages/database (Migration workflow)
```
**Total: 2 files.**

**Follow-up:** if backfill volume >1M rows, load `apps/workers/AGENTS.md` for the Temporal workflow side.

---

## Example 4 — "Add offline sync for visit logging on mobile"

**Classify:**
```
domain(s):  [mobile]
concerns:   [offline-first, forms, state-management, data-fetching, error-handling]
```

**Loading:**
```
Tier 0: AGENTS.md
Tier 1: apps/mobile/AGENTS.md
```
**Total: 2 files.**

If the sync surfaces a new API endpoint, escalate to Example 5.

---

## Example 5 — "Sync visits to backend when device reconnects"

**Classify:**
```
domain(s):  [api, mobile]
concerns:   [offline-first, business-logic, authorization, api-contract, testing, docs]
```

**Cross-boundary api + mobile → load integration doc.**

**Loading:**
```
Tier 0: AGENTS.md
Tier 1: docs/ai/integration-tasks/api-mobile.md
        apps/api/AGENTS.md
        apps/mobile/AGENTS.md
        packages/access/AGENTS.md         (authorization)
```
**Total: 5 files.**

---

## Example 6 — "Add a CNES ingestion source for another registry (Rio)"

**Classify:**
```
domain(s):  [shared-package, workers]
concerns:   [data-pipeline, integration, business-logic, observability, testing, docs]
```

**Loading:**
```
Tier 0: AGENTS.md
Tier 1: apps/workers/AGENTS.md
        packages/cnes-ingestion/AGENTS.md
        packages/observability/AGENTS.md
Tier 3: docs/architecture/features/clinic-doctor-registry.md
```
**Total: 5 files.**

---

## Example 7 — "Run the api tests locally after pulling main"

**Classify:**
```
domain(s):  [api]
concerns:   [testing, configuration, persistence]
```

**Loading:**
```
Tier 0: AGENTS.md
Tier 1: apps/api/AGENTS.md
        apps/api/TESTING.md
```
**Total: 3 files.**

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
