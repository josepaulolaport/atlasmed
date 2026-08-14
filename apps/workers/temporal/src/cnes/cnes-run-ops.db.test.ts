import { describe, expect, test } from "bun:test";
import { cnesRuns } from "@atlasmed/database";
import { eq } from "drizzle-orm";
import { db } from "../infrastructure/db";
import { failAbandonedCnesRuns } from "./cnes-run-ops";

/**
 * `failAbandonedCnesRuns` runs first on every CNES ingestion, so anything it
 * throws blocks every competence — which is exactly what happened in
 * production on 2026-08-14: the staleness cutoff was interpolated into a raw
 * `sql` template, which binds the `Date` straight to the driver instead of
 * through the column's codec, and Postgres' client rejected it with
 * `The "string" argument must be of type string ... Received an instance of
 * Date`. Every run died in its first activity, three seconds in.
 *
 * A fake proves nothing here: the failure was the driver refusing a parameter,
 * so only a real Postgres can show the query is now well-formed.
 */
const hasDb = await db
  .select({ ok: cnesRuns.id })
  .from(cnesRuns)
  .limit(1)
  .then(() => true)
  .catch(() => false);

/**
 * The partial unique on `(reference_year, reference_month) WHERE status =
 * 'RUNNING'` means two tests seeding the same competence collide. A year no
 * real competence will ever carry keeps this row clear of both the real data
 * and the other tests.
 */
function scratchCompetence(): { year: number; month: number } {
  return { year: 1900, month: 1 + Math.floor(Math.random() * 12) };
}

describe.skipIf(!hasDb)("failAbandonedCnesRuns (ingestion schema)", () => {
  test("fails a run left RUNNING by a dead worker", async () => {
    const { year, month } = scratchCompetence();
    const workflowId = `cnes-run-ops-test-${year}-${month}-${Date.now()}`;

    const [seeded] = await db
      .insert(cnesRuns)
      .values({
        temporalWorkflowId: workflowId,
        referenceYear: year,
        referenceMonth: month,
        status: "RUNNING",
        // Two hours ago, comfortably past the cutoff the call below uses.
        startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      })
      .returning({ id: cnesRuns.id });
    if (!seeded) throw new Error("failed to seed an abandoned CNES run");

    try {
      const failed = await failAbandonedCnesRuns({
        olderThanMs: 60 * 60 * 1000,
        exceptWorkflowId: "cnes-ingestion-some-other-run",
      });
      expect(failed).toBeGreaterThanOrEqual(1);

      const [row] = await db
        .select({ status: cnesRuns.status, finishedAt: cnesRuns.finishedAt })
        .from(cnesRuns)
        .where(eq(cnesRuns.id, seeded.id));
      expect(row?.status).toBe("FAILED");
      expect(row?.finishedAt).not.toBeNull();
    } finally {
      await db.delete(cnesRuns).where(eq(cnesRuns.id, seeded.id));
    }
  });

  test("leaves the caller's own run alone", async () => {
    const { year, month } = scratchCompetence();
    const workflowId = `cnes-run-ops-self-${year}-${month}-${Date.now()}`;

    const [seeded] = await db
      .insert(cnesRuns)
      .values({
        temporalWorkflowId: workflowId,
        referenceYear: year,
        referenceMonth: month,
        status: "RUNNING",
        startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      })
      .returning({ id: cnesRuns.id });
    if (!seeded) throw new Error("failed to seed the caller's own CNES run");

    try {
      await failAbandonedCnesRuns({
        olderThanMs: 60 * 60 * 1000,
        exceptWorkflowId: workflowId,
      });

      const [row] = await db
        .select({ status: cnesRuns.status })
        .from(cnesRuns)
        .where(eq(cnesRuns.id, seeded.id));
      expect(row?.status).toBe("RUNNING");
    } finally {
      await db.delete(cnesRuns).where(eq(cnesRuns.id, seeded.id));
    }
  });
});
