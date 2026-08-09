/**
 * Slice 2a CLI: import Emultec avulsa pages without Temporal (local/ops).
 *
 * Env: DATABASE_URL + EMULTEC_MYSQL_*
 *
 * Usage:
 *   bun src/scripts/import-emultec-orders.ts [--after-id=0] [--limit=50] [--max-pages=1]
 */
import { importEmultecOrdersPage } from "../emultec/import-emultec-orders";

function parseArg(name: string, fallback: number): number {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  if (!hit) return fallback;
  const n = Number(hit.slice(prefix.length));
  return Number.isFinite(n) ? n : fallback;
}

async function main() {
  const afterIdStart = parseArg("after-id", 0);
  const limit = parseArg("limit", 50);
  const maxPages = parseArg("max-pages", 1);

  let afterId = afterIdStart;
  let pages = 0;
  let fetched = 0;
  let upserted = 0;
  let skipped = 0;
  const skipReasons: Record<string, number> = {};

  while (pages < maxPages) {
    const page = await importEmultecOrdersPage({ afterId, limit });
    pages += 1;
    fetched += page.fetched;
    upserted += page.upserted;
    skipped += page.skipped;
    for (const [key, count] of Object.entries(page.skipReasons)) {
      skipReasons[key] = (skipReasons[key] ?? 0) + count;
    }
    console.log(
      JSON.stringify({
        page: pages,
        fetched: page.fetched,
        upserted: page.upserted,
        skipped: page.skipped,
        lastId: page.lastId,
        skipReasons: page.skipReasons,
      })
    );
    if (page.fetched === 0 || page.lastId == null) break;
    afterId = page.lastId;
    if (page.fetched < limit) break;
  }

  console.log(
    JSON.stringify(
      { pages, fetched, upserted, skipped, lastId: afterId, skipReasons },
      null,
      2
    )
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
