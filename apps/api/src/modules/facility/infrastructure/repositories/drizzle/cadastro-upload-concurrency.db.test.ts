import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { eq, inArray, sql } from "drizzle-orm";
import {
  conformityRequirements,
  documentFiles,
  facilities,
  fileAssets,
  municipalities,
  states,
  submissionDocuments,
} from "@atlasmed/database";
import { db } from "../../../../../infrastructure/database/db";
import { isDatabaseReachable } from "../../../../../test-utils/db-harness";
import { DrizzleCadastroSubmissionRepository } from "./drizzle-cadastro-submission.repository";

/**
 * Two reps uploading into one document, against a real database (D-15,
 * spec 0011 §4.4 and acceptance criterion 5).
 *
 * **Why this test does not use `withRollback`.** The claim is about
 * concurrency, and everything inside a single transaction is serialised by
 * definition — the harness that keeps every other DB test clean would quietly
 * make the race impossible to observe. Two genuinely concurrent calls need two
 * connections, so this commits its fixtures and purges them by name instead,
 * before *and* after the run — see `purgeFixtures`.
 *
 * **Why it seeds its own facility.** A database migrated from empty has no
 * states, municipalities, facilities or requirements — CI is exactly that. A
 * test leaning on production-clone data would pass locally and fail on CI, the
 * failure mode that has already bitten this repo more than once. Everything it
 * needs, it creates.
 */
const dbUp = await isDatabaseReachable();

const MARK = "T-CONC-UPLOAD";
const repository = new DrizzleCadastroSubmissionRepository();

interface Fixture {
  facilityId: number;
  requirementId: number;
  documentId: number;
  stateId: number;
  municipalityId: number;
}

/**
 * A suffix no other fixture in this process — or a leftover from an earlier run
 * — can repeat.
 *
 * The first version of this used `Math.random() % 100` for the state
 * abbreviation, which draws from a hundred values against a UNIQUE index. Three
 * states per run is a ~3% collision on a clean database, and it got worse with
 * use: a collision aborts the run mid-way, cleanup does not complete, and every
 * stranded row permanently consumes one of the hundred values. So the failure
 * rate climbed on any machine that had run the suite a few times, while staying
 * at zero on a freshly cloned one — which is exactly how it was reported.
 *
 * A timestamp gives cross-run uniqueness, the counter gives within-run
 * uniqueness (two fixtures can be seeded inside the same millisecond), and the
 * random tail covers two suites running against one database.
 */
let fixtureCounter = 0;
function uniqueSuffix(): string {
  fixtureCounter += 1;
  const random = Math.floor(Math.random() * 1_000_000);
  return `${Date.now().toString(36)}-${fixtureCounter}-${random.toString(36)}`;
}

async function seed(input: { maxFiles: number }): Promise<Fixture> {
  const suffix = uniqueSuffix();
  // ids are GENERATED ALWAYS identities. `ibge_id` and `abbreviation` are NOT
  // NULL and both carry a UNIQUE index, so both take the full suffix —
  // `abbreviation` is `text`, not a two-character code, so nothing here needs
  // to be truncated into a small space.
  const [state] = await db
    .insert(states)
    .values({
      name: `${MARK}-${suffix}`,
      ibgeId: `T-${suffix}`,
      abbreviation: `T-${suffix}`,
    })
    .returning({ id: states.id });

  const [municipality] = await db
    .insert(municipalities)
    .values({
      name: `${MARK}-${suffix}`,
      stateId: state!.id,
      ibgeId: `T${suffix}`,
    })
    .returning({ id: municipalities.id });

  const [facility] = await db
    .insert(facilities)
    .values({
      displayName: `${MARK}-${suffix}`,
      legalDocumentType: "CNPJ",
      stateId: state!.id,
      municipalityId: municipality!.id,
      // Spec 0009 R5: every clinic has a position.
      location: sql`ST_SetSRID(ST_MakePoint(-46.6, -23.5), 4326)`,
    })
    .returning({ id: facilities.id });

  const [requirement] = await db
    .insert(conformityRequirements)
    .values({
      slug: `${MARK}-${suffix}`,
      name: `${MARK}-${suffix}`,
      maxFiles: input.maxFiles,
      maxCombinedSizeBytes: 1_000_000,
    })
    .returning({ id: conformityRequirements.id });

  const [document] = await db
    .insert(submissionDocuments)
    .values({
      facilityId: facility!.id,
      requirementId: requirement!.id,
      title: MARK,
      status: "DRAFT",
    })
    .returning({ id: submissionDocuments.id });

  return {
    facilityId: facility!.id,
    requirementId: requirement!.id,
    documentId: document!.id,
    stateId: state!.id,
    municipalityId: municipality!.id,
  };
}

function attach(fixture: Fixture, n: number, sizeBytes = 100) {
  return repository.attachFileToDocument({
    documentId: fixture.documentId,
    facilityId: fixture.facilityId,
    bucket: "test-bucket",
    objectKey: `${MARK}/${fixture.documentId}/${n}/original`,
    originalFilename: `f${n}.jpg`,
    declaredMimeType: "image/jpeg",
    sizeBytes,
    role: "PAGE",
    maxFiles: 1,
    maxCombinedSizeBytes: 1_000_000,
  });
}

/**
 * Removes every fixture this file has ever left behind, not just this run's.
 *
 * Two properties matter. It runs *before* seeding as well as after, so a run
 * that died mid-way — killed suite, failed assertion, dropped connection —
 * cannot leave rows that poison later runs. And it deletes by the `MARK`
 * prefix rather than by remembered ids, so it also collects fixtures whose ids
 * were never recorded because the seed itself failed part-way through.
 *
 * Order follows the foreign keys inward-out. `document_files` is ON DELETE
 * restrict from `file_assets`, so the links must go first.
 */
async function purgeFixtures(): Promise<void> {
  const marked = sql`${facilities.displayName} like ${`${MARK}%`}`;

  await db.delete(documentFiles).where(
    sql`${documentFiles.submissionDocumentId} in (
      select id from submission_documents where title = ${MARK}
    )`
  );
  await db.delete(submissionDocuments).where(eq(submissionDocuments.title, MARK));
  await db.delete(fileAssets).where(
    sql`${fileAssets.facilityId} in (select id from facilities where ${marked})`
  );
  await db.delete(facilities).where(marked);
  await db
    .delete(conformityRequirements)
    .where(sql`${conformityRequirements.slug} like ${`${MARK}%`}`);
  await db
    .delete(municipalities)
    .where(sql`${municipalities.name} like ${`${MARK}%`}`);
  await db.delete(states).where(sql`${states.name} like ${`${MARK}%`}`);
}

beforeAll(purgeFixtures);
afterAll(purgeFixtures);

describe.skipIf(!dbUp)("concurrent uploads into one cadastro document", () => {
  test("two at once never collide on position and never orphan an asset", async () => {
    const fixture = await seed({ maxFiles: 10 });

    // Ten at once, all racing for the next position. Before the fix each read
    // the same max(position) and the losers hit
    // `document_files_document_position_uidx` as a raw 500 — after having
    // already committed a `file_assets` row with no link to anything.
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        repository.attachFileToDocument({
          documentId: fixture.documentId,
          facilityId: fixture.facilityId,
          bucket: "test-bucket",
          objectKey: `${MARK}/${fixture.documentId}/race-${i}/original`,
          originalFilename: `f${i}.jpg`,
          declaredMimeType: "image/jpeg",
          sizeBytes: 100,
          role: "PAGE",
          maxFiles: 10,
          maxCombinedSizeBytes: 1_000_000,
        })
      )
    );

    expect(results.every((r) => r.outcome === "attached")).toBe(true);

    const positions = results
      .filter((r) => r.outcome === "attached")
      .map((r) => (r as { position: number }).position)
      .sort((a, b) => a - b);
    // Every writer got its own slot, with no gaps and no duplicates.
    expect(positions).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    // Acceptance criterion 5: no orphaned `file_assets`. Every asset for this
    // facility must have a `document_files` row pointing at it.
    const [orphans] = await db
      .select({ n: sql<number>`count(*)` })
      .from(fileAssets)
      .where(
        sql`${fileAssets.facilityId} = ${fixture.facilityId}
            and not exists (select 1 from document_files df where df.file_asset_id = ${fileAssets.id})`
      );
    expect(Number(orphans?.n ?? 0)).toBe(0);
  });

  test("maxFiles holds under concurrency instead of being read then raced", async () => {
    const fixture = await seed({ maxFiles: 1 });

    // Both see zero files if the check is a plain read-then-insert, so both
    // pass it and the document ends up with two files against a limit of one.
    const results = await Promise.all([attach(fixture, 1), attach(fixture, 2)]);

    const attached = results.filter((r) => r.outcome === "attached");
    const rejected = results.filter((r) => r.outcome === "max_files_exceeded");
    expect(attached).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const [row] = await db
      .select({ n: sql<number>`count(*)` })
      .from(documentFiles)
      .where(eq(documentFiles.submissionDocumentId, fixture.documentId));
    expect(Number(row?.n ?? 0)).toBe(1);

    // The rejected caller must not have left a file_assets row behind — the
    // rollback is the point, not a later cleanup.
    const assets = await db
      .select({ id: fileAssets.id })
      .from(fileAssets)
      .where(eq(fileAssets.facilityId, fixture.facilityId));
    expect(assets).toHaveLength(1);
  });

  test("maxCombinedSizeBytes holds under concurrency too", async () => {
    const fixture = await seed({ maxFiles: 10 });

    // 600k + 600k against a 1M combined limit: exactly one may land.
    const results = await Promise.all([
      repository.attachFileToDocument({
        documentId: fixture.documentId,
        facilityId: fixture.facilityId,
        bucket: "test-bucket",
        objectKey: `${MARK}/${fixture.documentId}/big-1/original`,
        originalFilename: "big1.jpg",
        declaredMimeType: "image/jpeg",
        sizeBytes: 600_000,
        role: "PAGE",
        maxFiles: 10,
        maxCombinedSizeBytes: 1_000_000,
      }),
      repository.attachFileToDocument({
        documentId: fixture.documentId,
        facilityId: fixture.facilityId,
        bucket: "test-bucket",
        objectKey: `${MARK}/${fixture.documentId}/big-2/original`,
        originalFilename: "big2.jpg",
        declaredMimeType: "image/jpeg",
        sizeBytes: 600_000,
        role: "PAGE",
        maxFiles: 10,
        maxCombinedSizeBytes: 1_000_000,
      }),
    ]);

    expect(results.filter((r) => r.outcome === "attached")).toHaveLength(1);
    expect(
      results.filter((r) => r.outcome === "max_combined_size_exceeded")
    ).toHaveLength(1);

    const [row] = await db
      .select({ total: sql<number>`coalesce(sum(${fileAssets.sizeBytes}), 0)` })
      .from(documentFiles)
      .innerJoin(fileAssets, eq(documentFiles.fileAssetId, fileAssets.id))
      .where(eq(documentFiles.submissionDocumentId, fixture.documentId));
    expect(Number(row?.total ?? 0)).toBe(600_000);
  });

  test("a missing document is reported, not crashed on", async () => {
    const result = await repository.attachFileToDocument({
      documentId: 2_000_000_000,
      facilityId: 1,
      bucket: "test-bucket",
      objectKey: `${MARK}/missing/original`,
      originalFilename: "x.jpg",
      declaredMimeType: "image/jpeg",
      sizeBytes: 10,
      role: "PAGE",
      maxFiles: 10,
      maxCombinedSizeBytes: 1_000_000,
    });

    expect(result.outcome).toBe("document_missing");

    const leaked = await db
      .select({ id: fileAssets.id })
      .from(fileAssets)
      .where(inArray(fileAssets.objectKey, [`${MARK}/missing/original`]));
    expect(leaked).toHaveLength(0);
  });
});
