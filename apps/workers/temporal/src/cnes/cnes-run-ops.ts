import { and, eq, isNull, lt, sql } from "drizzle-orm";
import { cnesRuns } from "@atlasmed/database";
import { db } from "../infrastructure/db";
import { logger } from "../logger";

/**
 * The run ledger for CNES ingestion (ADR 0009 §3).
 *
 * One table, deliberately. Without it a failed monthly load is invisible and
 * "which competence is loaded" has no answer; with diff and suggestion tables it
 * would be the pipeline that got deleted for weighing more than it earned.
 */

export type CnesRunPhase =
  | "DISCOVERING"
  | "DOWNLOADING"
  | "EXTRACTING"
  | "PREFLIGHT"
  | "LOADING"
  | "VALIDATING"
  | "PROMOTING"
  | "BRIDGING";

export interface StartCnesRunInput {
  temporalWorkflowId: string;
  referenceYear: number;
  referenceMonth: number;
}

/**
 * Opens a run, or adopts the one this workflow already opened.
 *
 * Activities retry, and a retry must not leave a second RUNNING row for the same
 * competence — the partial unique index would reject it anyway, which would turn
 * an ordinary retry into a permanent failure.
 */
export async function startCnesRun(input: StartCnesRunInput): Promise<number> {
  const existing = await db
    .select({ id: cnesRuns.id })
    .from(cnesRuns)
    .where(eq(cnesRuns.temporalWorkflowId, input.temporalWorkflowId))
    .limit(1);
  const adopted = existing[0];
  if (adopted) return adopted.id;

  const [row] = await db
    .insert(cnesRuns)
    .values({
      temporalWorkflowId: input.temporalWorkflowId,
      referenceYear: input.referenceYear,
      referenceMonth: input.referenceMonth,
      status: "RUNNING",
      phase: "DISCOVERING",
      phaseStartedAt: new Date(),
    })
    .returning({ id: cnesRuns.id });
  if (!row) throw new Error("failed to open a CNES ingestion run");

  logger.info("cnes.ingestion.run_started", {
    runId: row.id,
    reference: `${input.referenceYear}-${String(input.referenceMonth).padStart(2, "0")}`,
  });
  return row.id;
}

export async function setCnesRunPhase(input: {
  runId: number;
  phase: CnesRunPhase;
}): Promise<void> {
  await db
    .update(cnesRuns)
    .set({ phase: input.phase, phaseStartedAt: new Date() })
    .where(eq(cnesRuns.id, input.runId));
}

export async function finishCnesRun(input: {
  runId: number;
  status: "COMPLETED" | "FAILED";
  stats?: Record<string, unknown>;
  archiveManifest?: unknown;
  error?: string;
}): Promise<void> {
  await db
    .update(cnesRuns)
    .set({
      status: input.status,
      finishedAt: new Date(),
      archiveManifest: input.archiveManifest ?? null,
      // `promoted_at` marks the moment the registry became the current snapshot,
      // which is only true of a run that completed.
      promotedAt: input.status === "COMPLETED" ? new Date() : null,
      stats: input.stats ?? null,
      error: input.error ?? null,
      phase: null,
    })
    .where(eq(cnesRuns.id, input.runId));

  logger.info("cnes.ingestion.run_digest", {
    runId: input.runId,
    status: input.status,
    statsJson: JSON.stringify(input.stats ?? {}),
    error: input.error,
  });
}

/**
 * Fails runs left RUNNING by a worker that died.
 *
 * Without this the partial unique on `(reference_year, reference_month) WHERE
 * status = 'RUNNING'` blocks that competence forever: the next attempt collides
 * with a run nobody is executing. Called at the start of each workflow rather
 * than on a timer, because that is when it matters and nowhere else.
 */
export async function failAbandonedCnesRuns(input: {
  olderThanMs: number;
  exceptWorkflowId: string;
}): Promise<number> {
  const cutoff = new Date(Date.now() - input.olderThanMs);
  const rows = await db
    .update(cnesRuns)
    .set({
      status: "FAILED",
      finishedAt: new Date(),
      error: "abandoned — still RUNNING when a later run started",
    })
    .where(
      and(
        eq(cnesRuns.status, "RUNNING"),
        isNull(cnesRuns.finishedAt),
        // lt(), not sql`... < ${cutoff}`: a raw template binds the Date straight
        // to the driver, skipping the column's codec, and the driver rejects it
        // with `The "string" argument must be of type string ... Received an
        // instance of Date`. That threw on every run, in the first activity, so
        // no CNES competence could ever load.
        lt(cnesRuns.startedAt, cutoff),
        sql`${cnesRuns.temporalWorkflowId} is distinct from ${input.exceptWorkflowId}`
      )
    )
    .returning({ id: cnesRuns.id });

  if (rows.length > 0) {
    logger.warn("cnes.ingestion.abandoned_runs_failed", {
      count: rows.length,
      runIds: rows.map((r) => r.id).join(","),
    });
  }
  return rows.length;
}
