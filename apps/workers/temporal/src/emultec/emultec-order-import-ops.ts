import { and, asc, eq, gt, isNull, sql } from "drizzle-orm";
import {
  emultecOrderImportDeadLetters,
  emultecOrderImportRuns,
} from "@atlasmed/database";
import { db } from "../infrastructure/db";
import { logger } from "../logger";

export type EmultecImportRunStatus = "RUNNING" | "SUCCEEDED" | "FAILED";

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
  skipped: number;
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
    skipped: input.skipped,
    skipReasonsJson: JSON.stringify(input.skipReasons),
    watermarkAfter: input.watermarkAfter ?? undefined,
    errorMessage: input.errorMessage ?? undefined,
  });
}

/** Open dead-letter avulsa ids after cursor, ascending. */
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
  await db
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
    });
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
