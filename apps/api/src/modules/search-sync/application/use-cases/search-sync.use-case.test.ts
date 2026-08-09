import { describe, expect, test } from "bun:test";
import {
  GetSearchSyncStatusUseCase,
  StartSearchSyncUseCase,
  parseSearchSyncRequest,
} from "./search-sync.use-case";

describe("search sync use cases", () => {
  test("starts full search rebuilds without accepting selective ids", async () => {
    const started: Array<"facilities" | "persons"> = [];
    const useCase = new StartSearchSyncUseCase({
      start: async (entity) => {
        started.push(entity);
        return { workflowId: `search-sync-${entity}-full`, runId: "run-1", existing: false };
      },
      startOrdersBackfill: async () => ({
        workflowId: "purchase-recurrence-backfill",
        runId: "run-orders",
        existing: false,
      }),
      startEmultecOrderImport: async () => ({
        workflowId: "emultec-order-import-hybrid",
        runId: "run-emultec",
        existing: false,
      }),
    });

    await expect(useCase.execute(parseSearchSyncRequest({ entity: "facilities" }))).resolves.toEqual({
      workflowId: "search-sync-facilities-full",
      runId: "run-1",
      existing: false,
    });
    expect(started).toEqual(["facilities"]);
    expect(() => parseSearchSyncRequest({ entity: "facilities", ids: ["x"] })).toThrow(
      "Request validation failed"
    );
  });

  test("starts the stable purchase-recurrence backfill for orders", async () => {
    let ordersBackfillStarts = 0;
    const useCase = new StartSearchSyncUseCase({
      start: async () => ({ workflowId: "unexpected", runId: "unexpected", existing: false }),
      startOrdersBackfill: async () => {
        ordersBackfillStarts += 1;
        return { workflowId: "purchase-recurrence-backfill", runId: "run-orders", existing: false };
      },
      startEmultecOrderImport: async () => ({
        workflowId: "unexpected-emultec",
        runId: "unexpected",
        existing: false,
      }),
    });

    await expect(useCase.execute(parseSearchSyncRequest({ entity: "orders" }))).resolves.toEqual({
      workflowId: "purchase-recurrence-backfill",
      runId: "run-orders",
      existing: false,
    });
    expect(ordersBackfillStarts).toBe(1);
  });

  test("starts Emultec HYBRID import for emultec-orders", async () => {
    let emultecStarts = 0;
    const useCase = new StartSearchSyncUseCase({
      start: async () => ({ workflowId: "unexpected", runId: "unexpected", existing: false }),
      startOrdersBackfill: async () => ({
        workflowId: "unexpected-orders",
        runId: "unexpected",
        existing: false,
      }),
      startEmultecOrderImport: async () => {
        emultecStarts += 1;
        return {
          workflowId: "emultec-order-import-hybrid",
          runId: "run-emultec",
          existing: false,
        };
      },
    });

    await expect(
      useCase.execute(parseSearchSyncRequest({ entity: "emultec-orders" }))
    ).resolves.toEqual({
      workflowId: "emultec-order-import-hybrid",
      runId: "run-emultec",
      existing: false,
    });
    expect(emultecStarts).toBe(1);
  });

  test("returns the Temporal status for a workflow id", async () => {
    const useCase = new GetSearchSyncStatusUseCase({
      describe: async (workflowId) => ({ workflowId, runId: "run-2", status: "RUNNING" }),
    });

    await expect(useCase.execute("search-sync-facilities-full")).resolves.toEqual({
      workflowId: "search-sync-facilities-full",
      runId: "run-2",
      status: "RUNNING",
    });
    await expect(useCase.execute("emultec-order-import-hybrid")).resolves.toEqual({
      workflowId: "emultec-order-import-hybrid",
      runId: "run-2",
      status: "RUNNING",
    });
    await expect(useCase.execute("other-workflow")).rejects.toMatchObject({
      code: "RESOURCE_NOT_FOUND",
    });
  });
});
