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
import { createDatabase } from "@atlasmed/database";
import { loadRegistryFromCsv } from "../src/load/load-registry";
import { openArchiveFromObjectStore, type RangeReadable } from "../src/archive/object-store-source";
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

const result = await loadRegistryFromCsv({
  db,
  reference,
  source,
  onProgress: (message, detail) => {
    const rss = (process.memoryUsage().rss / 1e6).toFixed(0);
    console.log(`[${elapsed()}s rss=${rss}MB] ${message}`, detail ?? "");
  },
});

console.log(JSON.stringify(result, null, 2));
console.log(`\npeak rss: ${(process.memoryUsage().rss / 1e6).toFixed(0)} MB`);
console.log(`total: ${elapsed()}s`);
process.exit(0);
