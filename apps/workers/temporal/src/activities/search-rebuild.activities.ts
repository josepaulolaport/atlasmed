import { rebuildFullSearchIndex, type SearchSyncTarget } from "../search/rebuild";

export async function rebuildSearchIndexActivity(input: { target: SearchSyncTarget }): Promise<void> {
  await rebuildFullSearchIndex(input.target);
}
