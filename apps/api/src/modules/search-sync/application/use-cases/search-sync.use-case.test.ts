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
      startCnesIngestion: async () => ({
        workflowId: "unexpected-cnes",
        runId: "unexpected",
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
      startCnesIngestion: async () => ({
        workflowId: "unexpected-cnes",
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
      startCnesIngestion: async () => ({
        workflowId: "unexpected-cnes",
        runId: "unexpected",
        existing: false,
      }),
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

  /**
   * Until now nothing could start a CNES ingestion at all: the API had no
   * starter for it, and `worker.ts` never provisioned its schedule. The load
   * only ever ran from `archive-load.ts`, which bypasses the workflow entirely.
   */
  test("starts a CNES ingestion, passing the competência through", async () => {
    const requests: Array<{ reference?: { year: number; month: number }; force?: boolean }> = [];
    const useCase = new StartSearchSyncUseCase({
      start: async () => ({ workflowId: "unexpected", runId: "unexpected", existing: false }),
      startOrdersBackfill: async () => ({
        workflowId: "unexpected-orders",
        runId: "unexpected",
        existing: false,
      }),
      startEmultecOrderImport: async () => ({
        workflowId: "unexpected-emultec",
        runId: "unexpected",
        existing: false,
      }),
      startCnesIngestion: async (input) => {
        requests.push(input);
        return {
          workflowId: "cnes-ingestion-trigger-202607",
          runId: "run-cnes",
          existing: false,
        };
      },
    });

    await expect(
      useCase.execute(
        parseSearchSyncRequest({
          entity: "cnes",
          reference: { year: 2026, month: 7 },
          force: true,
        })
      )
    ).resolves.toEqual({
      workflowId: "cnes-ingestion-trigger-202607",
      runId: "run-cnes",
      existing: false,
    });
    expect(requests).toEqual([{ reference: { year: 2026, month: 7 }, force: true }]);

    // Neither supplied is the ordinary case: discover the newest published.
    await useCase.execute(parseSearchSyncRequest({ entity: "cnes" }));
    expect(requests[1]).toEqual({ reference: undefined, force: undefined });
  });

  /*
   * `reference` and `force` mean nothing to the other entities. Accepting and
   * ignoring them would let "reload facilities for 2026-07" report success while
   * doing something else entirely.
   */
  test("refuses a competência on an entity that has none", () => {
    expect(() =>
      parseSearchSyncRequest({ entity: "facilities", reference: { year: 2026, month: 7 } })
    ).toThrow("Request validation failed");
    expect(() => parseSearchSyncRequest({ entity: "orders", force: true })).toThrow(
      "Request validation failed"
    );
    expect(() => parseSearchSyncRequest({ entity: "cnes", reference: { year: 2026, month: 13 } })).toThrow(
      "Request validation failed"
    );
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
    // Started by this endpoint, so readable from it — both the on-demand
    // trigger and the weekly schedule's own run.
    await expect(useCase.execute("cnes-ingestion-trigger-202607")).resolves.toMatchObject({
      status: "RUNNING",
    });
    await expect(useCase.execute("cnes-ingestion-trigger-latest")).resolves.toMatchObject({
      status: "RUNNING",
    });
    await expect(useCase.execute("cnes-ingestion-weekly")).resolves.toMatchObject({
      status: "RUNNING",
    });
    // Still an allowlist: a plausible-looking id is not one we started.
    await expect(useCase.execute("cnes-ingestion-trigger-20260")).rejects.toMatchObject({
      code: "RESOURCE_NOT_FOUND",
    });
    await expect(useCase.execute("other-workflow")).rejects.toMatchObject({
      code: "RESOURCE_NOT_FOUND",
    });
  });
});
