import { proxyActivities } from "@temporalio/workflow";

export const EMULTEC_ORDER_IMPORT_ACTIVITY_RETRY = { maximumAttempts: 3 } as const;

const activities = proxyActivities<typeof import("../activities/index")>({
  startToCloseTimeout: "30 minutes",
  retry: EMULTEC_ORDER_IMPORT_ACTIVITY_RETRY,
});

export type EmultecOrderImportWorkflowInput = {
  /** Exclusive watermark on avulsa.id; default 0. */
  afterId?: number;
  /** Page size (capped in activity). Default 100. */
  pageSize?: number;
  /** Stop after this many pages (safety). Default unlimited. */
  maxPages?: number;
};

export type EmultecOrderImportWorkflowResult = {
  pages: number;
  fetched: number;
  upserted: number;
  skipped: number;
  lastId: number | null;
  skipReasons: Record<string, number>;
};

/**
 * Slice 2a: page Emultec avulsa with whitelist lines into CRM orders.
 * Purchase-recurrence hook = Slice 2b.
 */
export async function emultecOrderImportWorkflow(
  input: EmultecOrderImportWorkflowInput = {}
): Promise<EmultecOrderImportWorkflowResult> {
  const pageSize = input.pageSize ?? 100;
  const maxPages = input.maxPages ?? Number.POSITIVE_INFINITY;
  let afterId = input.afterId ?? 0;
  let pages = 0;
  let fetched = 0;
  let upserted = 0;
  let skipped = 0;
  let lastId: number | null = afterId || null;
  const skipReasons: Record<string, number> = {};

  while (pages < maxPages) {
    const page = await activities.importEmultecOrdersPageActivity({
      afterId,
      limit: pageSize,
    });
    pages += 1;
    fetched += page.fetched;
    upserted += page.upserted;
    skipped += page.skipped;
    for (const [key, count] of Object.entries(page.skipReasons)) {
      skipReasons[key] = (skipReasons[key] ?? 0) + count;
    }
    if (page.fetched === 0 || page.lastId == null) break;
    lastId = page.lastId;
    afterId = page.lastId;
    if (page.fetched < pageSize) break;
  }

  return { pages, fetched, upserted, skipped, lastId, skipReasons };
}
