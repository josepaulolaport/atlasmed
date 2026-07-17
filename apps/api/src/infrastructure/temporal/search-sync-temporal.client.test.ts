import { describe, expect, test } from "bun:test";
import { WorkflowExecutionAlreadyStartedError } from "@temporalio/client";
import {
  fullSearchSyncWorkflowId,
  startFullSearchSyncWorkflowWithClient,
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
    expect(fullSearchSyncWorkflowId("professionals")).toBe("search-sync-professionals-full");
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
});
