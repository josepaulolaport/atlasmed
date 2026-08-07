import { proxyActivities } from "@temporalio/workflow";
import type { SearchSyncTarget } from "../search/rebuild";

export const SEARCH_SYNC_ACTIVITY_RETRY = { maximumAttempts: 3 } as const;

const activities = proxyActivities<typeof import("../activities/index")>({
  startToCloseTimeout: "60 minutes",
  retry: SEARCH_SYNC_ACTIVITY_RETRY,
});

export async function fullSearchSyncWorkflow(input: { target: SearchSyncTarget }): Promise<{ target: SearchSyncTarget }> {
  await activities.rebuildSearchIndexActivity(input);
  return { target: input.target };
}
