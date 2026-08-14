import { and, asc, eq, gt, isNull, lt, sql } from "drizzle-orm";
import {
  emultecOrderImportDeadLetters,
  emultecOrderImportRuns,
} from "@atlasmed/database";
import { db } from "../infrastructure/db";
import { logger } from "../logger";

export type EmultecImportRunStatus = "RUNNING" | "SUCCEEDED" | "FAILED";

/** Open DLQ rows at/above this attempt count are not replayed (ops alert). */
export const EMULTEC_DLQ_MAX_ATTEMPTS = 10;

export async function startEmultecImportRun(input: {
  mode: string;
  workflowId?: string | null;
  watermarkBefore?: number | null;
}): Promise<number> {
  const [row] = await db
    .insert(emultecOrderImportRuns)
    .values({
      mode: input.mode,
      workflowId: input.workflowId ?? null,
      watermarkBefore: input.watermarkBefore ?? null,
      status: "RUNNING",
    })
    .returning({ id: emultecOrderImportRuns.id });
  if (!row) throw new Error("failed to start emultec import run");
  return row.id;
}

export async function finishEmultecImportRun(input: {
  runId: number;
  status: EmultecImportRunStatus;
  fetched: number;
  upserted: number;
  /**
   * Of `upserted`, how many actually wrote a row.
   *
   * Log-only for now — `emultec_order_import_runs` has no column for it, and
   * adding one was not worth a second migration. It is the number that says
   * whether a run did anything: `upserted: 200, changed: 0` is a healthy
   * re-read, while the same run before write-only-when-changed would have
   * triggered a recurrence recalculation for 200 orders.
   */
  changed?: number;
  skipped: number;
  /**
   * Orders imported whose `facility_emultec_clients` link write failed.
   *
   * The link is best-effort by design — an order that resolved correctly must
   * not be dead-lettered over a bookkeeping row — but a swallowed error with no
   * number attached is how a broken link table stays invisible. Normally 0.
   */
  linkFailures?: number;
  skipReasons: Record<string, number>;
  watermarkAfter?: number | null;
  errorMessage?: string | null;
}): Promise<void> {
  await db
    .update(emultecOrderImportRuns)
    .set({
      status: input.status,
      finishedAt: new Date(),
      fetched: input.fetched,
      upserted: input.upserted,
      skipped: input.skipped,
      skipReasons: input.skipReasons,
      watermarkAfter: input.watermarkAfter ?? null,
      errorMessage: input.errorMessage ?? null,
    })
    .where(eq(emultecOrderImportRuns.id, input.runId));

  logger.info("emultec.order_import.run_digest", {
    runId: input.runId,
    status: input.status,
    fetched: input.fetched,
    upserted: input.upserted,
    changed: input.changed,
    skipped: input.skipped,
    linkFailures: input.linkFailures,
    skipReasonsJson: JSON.stringify(input.skipReasons),
    watermarkAfter: input.watermarkAfter ?? undefined,
    errorMessage: input.errorMessage ?? undefined,
  });
}

/**
 * Open dead-letter avulsa ids after cursor, ascending.
 * Exhausted rows (`attempt_count >= EMULTEC_DLQ_MAX_ATTEMPTS`) stay open for ops
 * but are excluded from automatic HYBRID replay.
 */
export async function listOpenEmultecDeadLetterIds(input: {
  afterId: number;
  limit: number;
}): Promise<number[]> {
  const rows = await db
    .select({ id: emultecOrderImportDeadLetters.idAvulsaEmultec })
    .from(emultecOrderImportDeadLetters)
    .where(
      and(
        isNull(emultecOrderImportDeadLetters.resolvedAt),
        lt(emultecOrderImportDeadLetters.attemptCount, EMULTEC_DLQ_MAX_ATTEMPTS),
        gt(emultecOrderImportDeadLetters.idAvulsaEmultec, input.afterId)
      )
    )
    .orderBy(asc(emultecOrderImportDeadLetters.idAvulsaEmultec))
    .limit(input.limit);
  return rows.map((r) => r.id);
}

export async function recordEmultecDeadLetter(input: {
  idAvulsa: number;
  reason: string;
  detail?: string | null;
}): Promise<void> {
  const now = new Date();
  const [row] = await db
    .insert(emultecOrderImportDeadLetters)
    .values({
      idAvulsaEmultec: input.idAvulsa,
      reason: input.reason,
      detail: input.detail ?? null,
      attemptCount: 1,
      firstFailedAt: now,
      lastFailedAt: now,
      resolvedAt: null,
    })
    .onConflictDoUpdate({
      target: emultecOrderImportDeadLetters.idAvulsaEmultec,
      set: {
        reason: input.reason,
        detail: input.detail ?? null,
        attemptCount: sql`${emultecOrderImportDeadLetters.attemptCount} + 1`,
        lastFailedAt: now,
        resolvedAt: null,
      },
    })
    .returning({
      attemptCount: emultecOrderImportDeadLetters.attemptCount,
      reason: emultecOrderImportDeadLetters.reason,
    });

  if (row && row.attemptCount >= EMULTEC_DLQ_MAX_ATTEMPTS) {
    logger.warn("emultec.order_import.dlq_exhausted", {
      idAvulsa: input.idAvulsa,
      attemptCount: row.attemptCount,
      maxAttempts: EMULTEC_DLQ_MAX_ATTEMPTS,
      reason: row.reason,
      detail: input.detail ?? undefined,
    });
  }
}

export async function resolveEmultecDeadLetter(idAvulsa: number): Promise<void> {
  await db
    .update(emultecOrderImportDeadLetters)
    .set({ resolvedAt: new Date() })
    .where(
      and(
        eq(emultecOrderImportDeadLetters.idAvulsaEmultec, idAvulsa),
        isNull(emultecOrderImportDeadLetters.resolvedAt)
      )
    );
}
