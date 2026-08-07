import { describe, expect, test } from "bun:test";
import { WorkflowExecutionAlreadyStartedError } from "@temporalio/client";
import {
  fullSearchSyncWorkflowId,
  isFullSearchSyncWorkflowId,
  purchaseRecurrenceBackfillWorkflowId,
  startFullSearchSyncWorkflowWithClient,
  startPurchaseRecurrenceBackfillWorkflowWithClient,
} from "./temporal.client";

describe("search sync Temporal client", () => {
  test("starts a deterministic full target execution", async () => {
    const startCalls: unknown[] = [];
    const client = {
      workflow: {
        start: async (_workflowType: "fullSearchSyncWorkflow", options: unknown) => {
          startCalls.push(options);
          return { firstExecutionRunId: "run-new", describe: async () => ({ runId: "run-new", status: { name: "RUNNING" } }) };
        },
        getHandle: () => ({ firstExecutionRunId: "unused", describe: async () => ({ runId: "unused", status: { name: "RUNNING" } }) }),
      },
    };

    await expect(startFullSearchSyncWorkflowWithClient(client, "facilities")).resolves.toEqual({
      workflowId: "search-sync-facilities-full",
      runId: "run-new",
      existing: false,
    });
    expect(startCalls).toHaveLength(1);
    expect(fullSearchSyncWorkflowId("persons")).toBe("search-sync-persons-full");
  });

  test("returns the running execution when Temporal reports a duplicate", async () => {
    const client = {
      workflow: {
        start: async () => { throw new WorkflowExecutionAlreadyStartedError("already running", "search-sync-facilities-full", "run-old"); },
        getHandle: () => ({
          firstExecutionRunId: "unused",
          describe: async () => ({ runId: "run-old", status: { name: "RUNNING" } }),
        }),
      },
    };

    await expect(startFullSearchSyncWorkflowWithClient(client, "facilities")).resolves.toEqual({
      workflowId: "search-sync-facilities-full",
      runId: "run-old",
      existing: true,
    });
  });

  test("starts the stable purchase-recurrence backfill and returns its existing run", async () => {
    const startCalls: unknown[] = [];
    const newClient = {
      workflow: {
        start: async (_workflowType: "purchaseRecurrenceWorkflow", options: unknown) => {
          startCalls.push(options);
          return { firstExecutionRunId: "run-orders", describe: async () => ({ runId: "run-orders", status: { name: "RUNNING" } }) };
        },
        getHandle: () => ({ firstExecutionRunId: "unused", describe: async () => ({ runId: "run-existing", status: { name: "RUNNING" } }) }),
      },
    };

    await expect(startPurchaseRecurrenceBackfillWorkflowWithClient(newClient)).resolves.toEqual({
      workflowId: "purchase-recurrence-backfill",
      runId: "run-orders",
      existing: false,
    });
    expect(startCalls).toEqual([{ taskQueue: expect.any(String), workflowId: "purchase-recurrence-backfill", args: [{ mode: "BACKFILL" }] }]);
    expect(purchaseRecurrenceBackfillWorkflowId()).toBe("purchase-recurrence-backfill");
    expect(isFullSearchSyncWorkflowId("purchase-recurrence-backfill")).toBe(true);

    const duplicateClient = {
      workflow: {
        start: async () => { throw new WorkflowExecutionAlreadyStartedError("already running", "purchase-recurrence-backfill", "run-existing"); },
        getHandle: () => ({
          firstExecutionRunId: "unused",
          describe: async () => ({ runId: "run-existing", status: { name: "RUNNING" } }),
        }),
      },
    };

    await expect(startPurchaseRecurrenceBackfillWorkflowWithClient(duplicateClient)).resolves.toEqual({
      workflowId: "purchase-recurrence-backfill",
      runId: "run-existing",
      existing: true,
    });
  });
});
