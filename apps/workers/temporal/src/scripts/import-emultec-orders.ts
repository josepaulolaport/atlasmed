/**
 * Emultec order import CLI (local/ops; Temporal optional via worker).
 *
 * Env: DATABASE_URL + EMULTEC_MYSQL_*
 *
 * Modes:
 *   BACKFILL     — full id scan from --after-id (default 0)
 *   INCREMENTAL  — id > CRM watermark (or --after-id)
 *   RECONCILE    — date window on Data/Finalizado/Sem_Faturamento (--since or --reconcile-days)
 *   HYBRID       — DLQ replay → RECONCILE → INCREMENTAL (default)
 *
 * Usage:
 *   bun src/scripts/import-emultec-orders.ts --mode=HYBRID --reconcile-days=30 --limit=200
 *   bun src/scripts/import-emultec-orders.ts --mode=BACKFILL --after-id=0 --max-pages=1
 */
import {
  getEmultecOrderWatermark,
  importEmultecOrdersPage,
} from "../emultec/import-emultec-orders";
import type { EmultecOrderPageMode } from "../emultec/fetch-emultec-orders";

type CliMode = EmultecOrderPageMode | "HYBRID";

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function parseNumber(name: string, fallback: number): number {
  const raw = argValue(name);
  if (raw == null) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function sinceDateFromDays(days: number): string {
  const now = new Date();
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

async function runPhase(input: {
  mode: EmultecOrderPageMode;
  afterId: number;
  limit: number;
  maxPages: number;
  sinceDate?: string;
}) {
  let afterId = input.afterId;
  let pages = 0;
  let fetched = 0;
  let upserted = 0;
  let skipped = 0;
  const skipReasons: Record<string, number> = {};
  const facilityIds = new Set<number>();

  while (pages < input.maxPages) {
    const page = await importEmultecOrdersPage({
      mode: input.mode,
      afterId,
      limit: input.limit,
      sinceDate: input.sinceDate,
    });
    pages += 1;
    fetched += page.fetched;
    upserted += page.upserted;
    skipped += page.skipped;
    for (const [key, count] of Object.entries(page.skipReasons)) {
      skipReasons[key] = (skipReasons[key] ?? 0) + count;
    }
    for (const id of page.facilityIds) facilityIds.add(id);
    console.log(
      JSON.stringify({
        phase: input.mode,
        page: pages,
        fetched: page.fetched,
        upserted: page.upserted,
        skipped: page.skipped,
        lastId: page.lastId,
        skipReasons: page.skipReasons,
      })
    );
    if (page.lastId == null) break;
    const progressed = page.lastId > afterId;
    afterId = page.lastId;
    if (page.fetched === 0 && !progressed) break;
    if (page.fetched > 0 && page.fetched < input.limit) break;
    if (page.fetched === 0 && progressed) continue;
  }

  return {
    pages,
    fetched,
    upserted,
    skipped,
    lastId: afterId,
    skipReasons,
    facilityIds: [...facilityIds],
  };
}

async function main() {
  const mode = (argValue("mode") ?? "HYBRID").toUpperCase() as CliMode;
  const limit = parseNumber("limit", 200);
  const maxPages = parseNumber("max-pages", 500);
  const reconcileDays = parseNumber("reconcile-days", 30);
  const sinceDate = argValue("since") ?? sinceDateFromDays(reconcileDays);
  const watermarkBefore = await getEmultecOrderWatermark();
  const afterIdArg = argValue("after-id");
  const afterId =
    afterIdArg != null
      ? Number(afterIdArg)
      : mode === "BACKFILL"
        ? 0
        : watermarkBefore;

  console.log(
    JSON.stringify({
      mode,
      watermarkBefore,
      afterId,
      sinceDate: mode === "RECONCILE" || mode === "HYBRID" ? sinceDate : null,
      limit,
      maxPages,
    })
  );

  let pages = 0;
  let fetched = 0;
  let upserted = 0;
  let skipped = 0;
  let lastId = afterId;
  const skipReasons: Record<string, number> = {};
  const facilityIds = new Set<number>();

  const absorb = (phase: Awaited<ReturnType<typeof runPhase>>) => {
    pages += phase.pages;
    fetched += phase.fetched;
    upserted += phase.upserted;
    skipped += phase.skipped;
    lastId = phase.lastId;
    for (const [k, v] of Object.entries(phase.skipReasons)) {
      skipReasons[k] = (skipReasons[k] ?? 0) + v;
    }
    for (const id of phase.facilityIds) facilityIds.add(id);
  };

  if (mode === "HYBRID") {
    absorb(
      await runPhase({
        mode: "DLQ_REPLAY",
        afterId: 0,
        limit,
        maxPages,
      })
    );
    absorb(
      await runPhase({
        mode: "RECONCILE",
        afterId: 0,
        limit,
        maxPages,
        sinceDate,
      })
    );
    absorb(
      await runPhase({
        mode: "INCREMENTAL",
        afterId: Number.isFinite(afterId) ? afterId : watermarkBefore,
        limit,
        maxPages,
      })
    );
  } else if (mode === "RECONCILE") {
    absorb(
      await runPhase({
        mode: "RECONCILE",
        afterId: Number.isFinite(afterId) ? afterId : 0,
        limit,
        maxPages,
        sinceDate,
      })
    );
  } else if (mode === "INCREMENTAL" || mode === "BACKFILL") {
    absorb(
      await runPhase({
        mode,
        afterId: Number.isFinite(afterId) ? afterId : 0,
        limit,
        maxPages,
      })
    );
  } else {
    throw new Error(`Unknown mode ${mode}`);
  }

  const watermarkAfter = await getEmultecOrderWatermark();
  console.log(
    JSON.stringify(
      {
        mode,
        pages,
        fetched,
        upserted,
        skipped,
        lastId,
        watermarkBefore,
        watermarkAfter,
        skipReasons,
        facilityIds: [...facilityIds].length,
      },
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
