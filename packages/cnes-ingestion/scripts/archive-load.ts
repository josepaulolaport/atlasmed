/**
 * End-to-end load against a real CNES archive in object storage.
 *
 * The sibling `smoke-load.ts` wants the export extracted to disk — 2.87 GB
 * across 109 files. This reads the ZIP in place over ranged requests, which is
 * what the monthly workflow actually does, so it exercises the path that will
 * run unattended rather than a convenient stand-in.
 *
 *   DATABASE_URL=postgresql://…/atlasmed_test_lane_b \
 *     bun scripts/archive-load.ts cnes/BASE_DE_DADOS_CNES_202607.ZIP 202607
 *
 * Point it at a disposable database. It writes `registry.*` and
 * `ingestion.*_staging`, and step 6 replaces the staff snapshot for every
 * facility in scope.
 */
import { createDatabase, cnesRuns } from "@atlasmed/database";
import { eq, sql } from "drizzle-orm";
import { loadRegistryFromCsv } from "../src/load/load-registry";
import { openArchiveFromObjectStore, type RangeReadable } from "../src/archive/object-store-source";
import { selectArchivesToPrune } from "../src/archive/prune-archives";
import { parseReference } from "../src/cnes-files";

const [objectKey, referenceArg] = process.argv.slice(2);

if (!objectKey || !referenceArg) {
  console.error("usage: bun scripts/archive-load.ts <objectKey> <YYYYMM>");
  process.exit(2);
}

const reference = parseReference(referenceArg);
if (!reference) {
  console.error(`not a CNES competence: ${referenceArg} (expected YYYYMM)`);
  process.exit(2);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is required");
  process.exit(2);
}
if (!connectionString.includes("test") && !connectionString.includes("scratch")) {
  console.error("refusing to load into a database whose name says it is not disposable");
  process.exit(2);
}

const client = new Bun.S3Client({
  accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "minioadmin",
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "minioadmin",
  bucket: process.env.S3_BUCKET ?? "atlasmed-dev",
  endpoint: process.env.S3_ENDPOINT ?? "http://localhost:9000",
});
const object = client.file(objectKey);
const readable: RangeReadable = {
  async size() {
    return (await object.stat()).size;
  },
  async read(from, to) {
    return new Uint8Array(await object.slice(from, to + 1).arrayBuffer());
  },
};

const db = createDatabase(connectionString);
const startedAt = Date.now();
const elapsed = () => ((Date.now() - startedAt) / 1000).toFixed(1);

const source = await openArchiveFromObjectStore({
  readable,
  reference,
  onProgress: (message, detail) => console.log(`[${elapsed()}s] ${message}`, detail ?? ""),
});

/*
 * This script writes the run ledger too, and that is not bookkeeping.
 *
 * `ingestion.cnes_runs` is what tells a reader which competência is *finished*.
 * `deriveRosterFromStaging` prefers the one marked COMPLETED precisely so an
 * import landing mid-reload cannot derive a roster from a half-loaded table
 * (spec 0015 §6.7 rule 1). The Temporal workflow maintains the ledger properly —
 * phases, retries, abandoned-run recovery — but this script is the path that
 * actually gets run, and it wrote nothing. So the guard was inert: with no
 * COMPLETED row ever present, every reader fell through to "newest staged",
 * which is exactly the half-loaded competência the rule excludes.
 *
 * A one-shot script does not need the workflow's phase machinery. It needs the
 * competência to be marked finished only once it is.
 */
const workflowId = `archive-load:${reference.year}-${String(reference.month).padStart(2, "0")}:${startedAt}`;
const [run] = await db
  .insert(cnesRuns)
  .values({
    temporalWorkflowId: workflowId,
    referenceYear: reference.year,
    referenceMonth: reference.month,
    status: "RUNNING",
    phase: "LOADING",
    phaseStartedAt: new Date(),
  })
  .returning({ id: cnesRuns.id });

async function finish(
  status: "COMPLETED" | "FAILED",
  extra: { stats?: unknown; error?: string }
): Promise<void> {
  if (!run) return;
  await db
    .update(cnesRuns)
    .set({
      status,
      finishedAt: new Date(),
      // Only a completed run is a snapshot anybody may read from.
      promotedAt: status === "COMPLETED" ? new Date() : null,
      stats: (extra.stats as never) ?? null,
      error: extra.error ?? null,
      phase: null,
    })
    .where(eq(cnesRuns.id, run.id));
}

let result;
try {
  result = await loadRegistryFromCsv({
    db,
    reference,
    source,
    onProgress: (message, detail) => {
      const rss = (process.memoryUsage().rss / 1e6).toFixed(0);
      console.log(`[${elapsed()}s rss=${rss}MB] ${message}`, detail ?? "");
    },
  });
} catch (error) {
  /*
   * A failed load must not leave the competência looking finished. Marking it
   * FAILED is what keeps readers on the previous COMPLETED one instead of a
   * partially written table.
   */
  await finish("FAILED", {
    error: error instanceof Error ? error.message : String(error),
  });
  throw error;
}

await finish("COMPLETED", { stats: result });

/*
 * Spec 0015 §6.7: keep one competência. Staging is ~316 MB per month and is a
 * derived projection — it can be rebuilt from the archive without losing a fact —
 * so retaining superseded months buys nothing and grows without bound. Pruned
 * only after this run is marked COMPLETED, so a reader is never left with no
 * competência at all.
 */
const prunedCarga = await db.execute(
  sql`delete from ingestion.carga_staging
       where (reference_year, reference_month) <> (${reference.year}, ${reference.month})`
);
const prunedProfessionals = await db.execute(
  sql`delete from ingestion.professional_staging
       where (reference_year, reference_month) <> (${reference.year}, ${reference.month})`
);
console.log(
  `[${elapsed()}s] staging pruned to ${reference.year}-${String(reference.month).padStart(2, "0")}`,
  {
    carga: (prunedCarga as unknown as { count?: number }).count ?? null,
    professionals: (prunedProfessionals as unknown as { count?: number }).count ?? null,
  }
);

/*
 * Prune superseded archives, keeping two.
 *
 * The workflow has `pruneCnesArchivesActivity` for this; this script had nothing,
 * so on the path that actually runs every monthly ZIP accumulated — 735 MB each.
 * Same omission as the run ledger and the staging prune above, and the same fix:
 * whatever the workflow does after a promotion, this has to do too.
 *
 * Two, not one: the previous competência is what you compare against when a load
 * looks wrong, and re-downloading it is 735 MB. The one just loaded is protected
 * explicitly so an unusual `keep` can never delete the archive this run read.
 *
 * After the promotion, never before — a failed load must not delete anything.
 * Keys under `cnes/` that are not archives are reported and left alone; the
 * bucket also holds cadastro documents and avatars.
 */
const listed = await client.list({ prefix: "cnes/" });
const decision = selectArchivesToPrune({
  keys: (listed.contents ?? [])
    .map((object) => object.key)
    .filter((key): key is string => typeof key === "string"),
  keep: 2,
  protectedReference: reference,
});

for (const archive of decision.prune) {
  await client.delete(archive.key);
}
if (decision.ignored.length > 0) {
  console.warn(
    `[${elapsed()}s] prune walked past ${decision.ignored.length} non-archive key(s) under cnes/`,
    decision.ignored.slice(0, 5)
  );
}
console.log(`[${elapsed()}s] archives pruned`, {
  deleted: decision.prune.map((a) => a.key),
  kept: decision.keep.map((a) => a.key),
});

console.log(JSON.stringify(result, null, 2));
console.log(`\npeak rss: ${(process.memoryUsage().rss / 1e6).toFixed(0)} MB`);
console.log(`total: ${elapsed()}s`);
process.exit(0);
