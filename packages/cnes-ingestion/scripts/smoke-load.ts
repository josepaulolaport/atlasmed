/**
 * Manual end-to-end load against a real CNES dump.
 *
 * Not a CI test — it needs the extracted export (2.87 GB across 109 files in
 * 202605, of which the six we read are 2.01 GB), which no runner has. It exists
 * because "the loader typechecks" is not evidence it loads: this is how you find
 * out, before a monthly workflow does it unattended.
 *
 *   DATABASE_URL=postgresql://…/atlasmed_scratch \
 *     bun scripts/smoke-load.ts <csvDir> <YYYYMM>
 *
 * Point it at a disposable database. It writes to `registry.*` only, but the
 * scope query reads `public.facilities`, so it reports nothing useful against a
 * database with no `cnes_code` populated.
 */
import { createDatabase } from "@atlasmed/database";
import { loadRegistryFromCsv } from "../src/index";
import { parseReference } from "../src/cnes-files";

const [csvDir, referenceArg] = process.argv.slice(2);

if (!csvDir || !referenceArg) {
  console.error("usage: bun scripts/smoke-load.ts <csvDir> <YYYYMM>");
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

const db = createDatabase(connectionString);
const startedAt = Date.now();

const result = await loadRegistryFromCsv({
  db,
  csvDir,
  reference,
  onProgress: (message, detail) => {
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(`[${elapsed}s] ${message}`, detail ?? "");
  },
});

console.log(JSON.stringify(result, null, 2));

if (result.scopedFacilities === 0) {
  console.error("\nno facility carried a cnes_code — the load did nothing");
  process.exit(1);
}

process.exit(0);
