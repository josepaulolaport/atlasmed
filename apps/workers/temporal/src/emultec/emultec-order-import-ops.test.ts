import { describe, expect, test } from "bun:test";
import { eq, sql } from "drizzle-orm";
import {
  emultecOrderImportDeadLetters,
  emultecOrderImportRuns,
} from "@atlasmed/database";
import { db } from "../infrastructure/db";
import {
  EMULTEC_DLQ_MAX_ATTEMPTS,
  finishEmultecImportRun,
  listOpenEmultecDeadLetterIds,
  recordEmultecDeadLetter,
  resolveEmultecDeadLetter,
  startEmultecImportRun,
} from "./emultec-order-import-ops";

/**
 * Reachability, not configuration. `DATABASE_URL` is set by `.env.test` on
 * every machine, so gating on it made these two tests fail with a Postgres auth
 * error on any checkout without a local database instead of skipping. CI always
 * has one, so nothing is lost where it counts.
 */
const hasDb = await db
  .execute(sql`SELECT 1`)
  .then(() => true)
  .catch(() => false);

describe("emultec-order-import-ops (ops schema)", () => {
  test.skipIf(!hasDb)("run digest + dead-letter lifecycle on ops.*", async () => {
    const idAvulsa = 9_000_000_001 + Math.floor(Math.random() * 1000);

    const runId = await startEmultecImportRun({
      mode: "HYBRID",
      workflowId: "test-emultec-ops",
      watermarkBefore: 42,
    });
    expect(runId).toBeGreaterThan(0);

    await finishEmultecImportRun({
      runId,
      status: "SUCCEEDED",
      fetched: 3,
      upserted: 1,
      skipped: 2,
      skipReasons: { seller_unmapped: 2 },
      watermarkAfter: 99,
    });

    const [run] = await db
      .select()
      .from(emultecOrderImportRuns)
      .where(eq(emultecOrderImportRuns.id, runId));
    expect(run?.status).toBe("SUCCEEDED");
    expect(run?.skipReasons).toEqual({ seller_unmapped: 2 });
    expect(run?.watermarkAfter).toBe(99);

    await recordEmultecDeadLetter({
      idAvulsa,
      reason: "upsert_error",
      detail: "boom",
    });
    await recordEmultecDeadLetter({
      idAvulsa,
      reason: "upsert_error",
      detail: "boom-2",
    });

    const open = await listOpenEmultecDeadLetterIds({ afterId: 0, limit: 50 });
    expect(open).toContain(idAvulsa);

    const [dl] = await db
      .select()
      .from(emultecOrderImportDeadLetters)
      .where(eq(emultecOrderImportDeadLetters.idAvulsaEmultec, idAvulsa));
    expect(dl?.attemptCount).toBe(2);
    expect(dl?.resolvedAt).toBeNull();

    await resolveEmultecDeadLetter(idAvulsa);
    const openAfter = await listOpenEmultecDeadLetterIds({ afterId: 0, limit: 50 });
    expect(openAfter).not.toContain(idAvulsa);

    await db
      .delete(emultecOrderImportDeadLetters)
      .where(eq(emultecOrderImportDeadLetters.idAvulsaEmultec, idAvulsa));
    await db
      .delete(emultecOrderImportRuns)
      .where(eq(emultecOrderImportRuns.id, runId));
  });

  test.skipIf(!hasDb)("excludes exhausted DLQ rows from replay list", async () => {
    const idAvulsa = 9_000_001_001 + Math.floor(Math.random() * 1000);

    for (let i = 0; i < EMULTEC_DLQ_MAX_ATTEMPTS; i += 1) {
      await recordEmultecDeadLetter({
        idAvulsa,
        reason: "error",
        detail: `attempt-${i + 1}`,
      });
    }

    const [dl] = await db
      .select()
      .from(emultecOrderImportDeadLetters)
      .where(eq(emultecOrderImportDeadLetters.idAvulsaEmultec, idAvulsa));
    expect(dl?.attemptCount).toBe(EMULTEC_DLQ_MAX_ATTEMPTS);
    expect(dl?.resolvedAt).toBeNull();

    const open = await listOpenEmultecDeadLetterIds({ afterId: 0, limit: 200 });
    expect(open).not.toContain(idAvulsa);

    await db
      .delete(emultecOrderImportDeadLetters)
      .where(eq(emultecOrderImportDeadLetters.idAvulsaEmultec, idAvulsa));
  });
});
