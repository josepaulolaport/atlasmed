# AI Task Router

Worked examples for the task lifecycle from root `AGENTS.md`. Use as templates when classifying a new task.

Each example ends with the exact "Loading:" announcement the AI should output BEFORE editing.

Per-app / per-package `AGENTS.md` files were consolidated into root `AGENTS.md` domain sections. Load those sections (and named feature/spec docs), not deleted `apps/*/AGENTS.md` paths.

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
        AGENTS.md § apps/api
        AGENTS.md § apps/web
        AGENTS.md § packages/access          (authorization concern)
        docs/architecture/features/access-auth.md
```
**Total: 5 files** (root AGENTS counted once).

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
Tier 1: AGENTS.md § apps/web
        apps/web/README.md
```
**Total: 2 files.**

Design tokens (zinc palette + section-card pattern) come from `AGENTS.md` § `apps/web` Conventions.

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
**Total: 1–2 files.**

**Follow-up:** if backfill volume >1M rows, load `AGENTS.md` § `apps/workers` for the Temporal workflow side.

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
Tier 1: AGENTS.md § apps/mobile
```
**Total: 1–2 files.**

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
        AGENTS.md § apps/api
        AGENTS.md § apps/mobile
        AGENTS.md § packages/access         (authorization)
        docs/architecture/features/access-auth.md
```
**Total: 4–5 files.**

---

## Example 6 — "Add a CNES ingestion source for another registry (Rio)"

**Blocked / historical:** CNES ingest package + `registry`/`ingestion` schemas removed. Requires a new ADR + product decision before any reload path. Do not point agents at deleted `packages/cnes-ingestion`.

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
Tier 1: AGENTS.md § apps/api
        apps/api/TESTING.md
```
**Total: 2–3 files.**

---

## Anti-patterns

- Loading `docs/product/*` for a UI restyle.
- Loading every domain section "for context."
- Loading `docs/architecture/adr/*` on routine tasks.
- Pointing at deleted `apps/*/AGENTS.md` or `packages/*/AGENTS.md` paths.

## Deciding: single-domain or cross-boundary?

- Files edited in ONE app → single-domain.
- Files edited in ≥2 apps OR a shared package → cross-boundary → load integration doc.
- Ambiguous? If the task changes a contract consumed by another app, it's cross-boundary.
