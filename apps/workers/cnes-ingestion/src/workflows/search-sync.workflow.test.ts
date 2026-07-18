import { describe, expect, test } from "bun:test";
import { SEARCH_SYNC_ACTIVITY_RETRY } from "./search-sync.workflow";

describe("fullSearchSyncWorkflow configuration", () => {
  test("retries a failed rebuild activity three times", () => {
    expect(SEARCH_SYNC_ACTIVITY_RETRY).toEqual({ maximumAttempts: 3 });
  });
});
