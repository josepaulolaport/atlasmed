import { describe, expect, test } from "bun:test";
import {
  GetSearchSyncStatusUseCase,
  StartSearchSyncUseCase,
  parseSearchSyncRequest,
} from "./search-sync.use-case";

describe("search sync use cases", () => {
  test("starts a full facilities rebuild without accepting selective ids", async () => {
    const started: Array<"facilities" | "professionals"> = [];
    const useCase = new StartSearchSyncUseCase({
      start: async (entity) => {
        started.push(entity);
        return { workflowId: `search-sync-${entity}-full`, runId: "run-1", existing: false };
      },
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

  test("returns the Temporal status for a workflow id", async () => {
    const useCase = new GetSearchSyncStatusUseCase({
      describe: async (workflowId) => ({ workflowId, runId: "run-2", status: "RUNNING" }),
    });

    await expect(useCase.execute("search-sync-facilities-full")).resolves.toEqual({
      workflowId: "search-sync-facilities-full",
      runId: "run-2",
      status: "RUNNING",
    });
    await expect(useCase.execute("other-workflow")).rejects.toMatchObject({
      code: "RESOURCE_NOT_FOUND",
    });
  });
});
