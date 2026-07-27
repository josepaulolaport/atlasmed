# Sync Orders Backfill Design

## Goal

Expose the existing purchase-recurrence backfill through the authorized sync API while renaming the public search-sync routes to `/sync`.

## API contract

- `POST /sync` accepts a strict body of `{ "entity": "facilities" | "professionals" | "orders" }` and returns `202`.
- `facilities` and `professionals` preserve the existing full-search-rebuild behavior and deterministic workflow IDs.
- `orders` starts `purchaseRecurrenceWorkflow` with `{ mode: "BACKFILL" }` on the configured Temporal task queue.
- The orders backfill workflow ID is the stable `purchase-recurrence-backfill`. If it is already running, the response reports its run ID with `existing: true` instead of starting an overlapping backfill.
- `GET /sync/:workflowId` returns Temporal status for either a full-search-sync workflow ID or `purchase-recurrence-backfill`.
- The legacy `/search-sync` routes are removed.

## Architecture

The existing `search-sync` module remains the operations endpoint boundary. Its request parser accepts the expanded entity union; its start use case dispatches through a small port that encapsulates whether the target is a search rebuild or orders backfill. The Temporal client owns stable IDs, start/idempotency handling, and the allowed workflow-ID predicate used by the status use case.

No change is required in the Temporal worker: `purchaseRecurrenceWorkflow` is already exported and supports `BACKFILL`, including final facilities search rebuilding.

## Authorization and errors

Both routes retain `auth` and `requirePermission("manage", "SEARCH_SYNC")`. Invalid entities and unexpected body fields remain structured validation errors. Unknown workflow IDs remain `RESOURCE_NOT_FOUND`; Temporal's `WorkflowNotFoundError` remains mapped to the same error.

## Tests and documentation

Test-first coverage will prove `orders` parsing and dispatch, its stable Temporal ID and duplicate-run behavior, and status acceptance. Existing facilities/professionals behavior remains covered. The clinic/registry operations documentation will replace its legacy `/search-sync` examples with `/sync` and document the orders backfill invocation.
