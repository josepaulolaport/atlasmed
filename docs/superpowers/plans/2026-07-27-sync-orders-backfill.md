# Sync Orders Backfill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the authorized sync endpoint to `/sync` and allow it to start the stable purchase-recurrence orders backfill.

**Architecture:** Keep `search-sync` as the operation module, expand its entity union to include `orders`, and dispatch to the Temporal client. The Temporal client owns the stable `purchase-recurrence-backfill` ID and duplicate-start behavior; status validation recognizes search and orders workflow IDs.

**Tech Stack:** Bun, TypeScript, Elysia, Zod, Temporal client, bun:test.

---

### Task 1: Prove and add orders parsing/dispatch

**Files:**
- Modify: `apps/api/src/modules/search-sync/application/use-cases/search-sync.use-case.test.ts`
- Modify: `apps/api/src/modules/search-sync/application/use-cases/search-sync.use-case.ts`
- Modify: `apps/api/src/modules/search-sync/composition.ts`

- [ ] **Step 1: Write failing tests**

Add a parser assertion for `{ entity: "orders" }` and a use-case assertion that routes it to an injected `startOrdersBackfill` dependency while facilities still uses the full-search dependency.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `bun --cwd apps/api test src/modules/search-sync/application/use-cases/search-sync.use-case.test.ts`

Expected: FAIL because `orders` is outside the parser/type union or no dispatch port exists.

- [ ] **Step 3: Implement the minimal dispatch boundary**

Define `SearchSyncEntity = "facilities" | "professionals" | "orders"`; make `StartSearchSyncUseCase` dispatch orders to `startOrdersBackfill`; wire `startPurchaseRecurrenceBackfillWorkflow` in composition.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `bun --cwd apps/api test src/modules/search-sync/application/use-cases/search-sync.use-case.test.ts`

Expected: PASS.

### Task 2: Start and inspect the stable orders backfill

**Files:**
- Modify: `apps/api/src/infrastructure/temporal/search-sync-temporal.client.test.ts`
- Modify: `apps/api/src/infrastructure/temporal/temporal.client.ts`

- [ ] **Step 1: Write failing tests**

Test a Temporal start call for `purchaseRecurrenceWorkflow`, with workflow ID `purchase-recurrence-backfill` and args `[{ mode: "BACKFILL" }]`, plus a duplicate-start response with `existing: true`. Test that the allowed-ID predicate accepts the stable orders ID.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `bun --cwd apps/api test src/infrastructure/temporal/search-sync-temporal.client.test.ts`

Expected: FAIL because the backfill starter and allowed workflow ID do not exist.

- [ ] **Step 3: Implement the Temporal client functions**

Add `purchaseRecurrenceBackfillWorkflowId`, `startPurchaseRecurrenceBackfillWorkflowWithClient`, and its live-client wrapper. Reuse the existing Temporal duplicate-workflow handling shape; widen status-ID validation to include orders.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `bun --cwd apps/api test src/infrastructure/temporal/search-sync-temporal.client.test.ts`

Expected: PASS.

### Task 3: Rename public routes and document operations

**Files:**
- Modify: `apps/api/src/modules/search-sync/infrastructure/routes/search-sync.route.ts`
- Modify: `docs/architecture/features/clinic-doctor-registry.md`

- [ ] **Step 1: Change the Elysia route paths and OpenAPI text**

Replace `POST /search-sync` and `GET /search-sync/:workflowId` with `/sync` equivalents. Extend the TypeBox request union with `orders`; retain status code 202, authentication, and `manage:SEARCH_SYNC` permission.

- [ ] **Step 2: Update operational documentation**

Replace legacy search-sync endpoint examples with `/sync`; add an explicit `{ "entity": "orders" }` backfill example and stable workflow ID.

- [ ] **Step 3: Run API typecheck and targeted tests**

Run: `bun run api:typecheck && bun --cwd apps/api test src/modules/search-sync/application/use-cases/search-sync.use-case.test.ts src/infrastructure/temporal/search-sync-temporal.client.test.ts`

Expected: exit code 0.

### Task 4: Verify and deliver

**Files:**
- Review: all files above

- [ ] **Step 1: Run API test, lint, and typecheck**

Run: `bun run api:test && bun run api:lint && bun run api:typecheck`

Expected: all commands exit 0.

- [ ] **Step 2: Review the final diff against this plan**

Run: `git diff --check && git diff --stat && git status --short`

Expected: no whitespace errors; only planned files changed.

- [ ] **Step 3: Commit and publish the branch**

Run: `git add <planned files> && git commit -m "feat(api): start orders recurrence backfill from sync" && git push -u origin HEAD`

Expected: commit and push succeed.
