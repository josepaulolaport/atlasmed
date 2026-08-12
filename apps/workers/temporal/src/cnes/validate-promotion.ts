import { and, desc, eq, isNotNull, ne } from "drizzle-orm";
import { cnesRuns } from "@atlasmed/database";
import type { PromotionSummary } from "@atlasmed/cnes-ingestion";
import { db } from "../infrastructure/db";
import { logger } from "../logger";

/**
 * The gate the schema always anticipated: `cnes_run_phase` carries `VALIDATING`
 * and the table carries `validation_report`, and until now nothing validated.
 *
 * A run replaces the roster of every clinic we operate, unconditionally. Reads
 * are length-strict so a truncated download throws — but a *semantically* thin
 * export loads perfectly and blanks the feature. That failure is invisible: the
 * run says COMPLETED, the API says 200, and every clinic simply stops
 * suggesting anyone. This turns it into a failed run with numbers attached.
 */

/**
 * How far a count may fall against the last good run before the load is refused.
 *
 * 0.5 rather than something tighter because the legitimate month-to-month drift
 * is small and a false refusal is expensive — it needs a human to override. A
 * halving is not drift; it is a broken export.
 */
export const COLLAPSE_RATIO = 0.5;

export interface PromotionBaseline {
  runId: number;
  reference: string;
  vinculos: number;
  professionals: number;
}

export interface PromotionValidation {
  decision: "PROMOTE" | "REFUSE";
  reasons: string[];
  baseline: PromotionBaseline | null;
  summary: PromotionSummary;
  collapseRatio: number;
}

export class PromotionRefused extends Error {
  constructor(readonly validation: PromotionValidation) {
    super(
      `refusing to promote the CNES snapshot: ${validation.reasons.join("; ")}`
    );
    this.name = "PromotionRefused";
  }
}

/** Stats of the most recent run that actually promoted, if there is one. */
async function lastPromotedBaseline(
  currentRunId: number
): Promise<PromotionBaseline | null> {
  const rows = await db
    .select({
      id: cnesRuns.id,
      referenceYear: cnesRuns.referenceYear,
      referenceMonth: cnesRuns.referenceMonth,
      stats: cnesRuns.stats,
    })
    .from(cnesRuns)
    .where(
      and(
        eq(cnesRuns.status, "COMPLETED"),
        isNotNull(cnesRuns.promotedAt),
        ne(cnesRuns.id, currentRunId)
      )
    )
    .orderBy(desc(cnesRuns.promotedAt))
    .limit(1);

  const row = rows[0];
  const stats = row?.stats as Record<string, unknown> | null | undefined;
  if (!row || !stats) return null;

  const asCount = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) ? value : 0;

  return {
    runId: row.id,
    reference: `${row.referenceYear}-${String(row.referenceMonth).padStart(2, "0")}`,
    vinculos: asCount(stats.vinculos),
    professionals: asCount(stats.professionalsUpserted),
  };
}

export function judgePromotion(input: {
  summary: PromotionSummary;
  baseline: PromotionBaseline | null;
}): PromotionValidation {
  const { summary, baseline } = input;
  const reasons: string[] = [];

  // Independent of history: a run that resolved no clinics has nothing to say
  // about any of them, and replacing every roster from it is pure destruction.
  if (summary.scopedFacilities === 0) {
    reasons.push("no facility carries a cnes_code, so there is nothing to promote");
  } else if (summary.vinculos === 0) {
    reasons.push(
      `the export yielded no facility↔professional rows for ${summary.scopedFacilities} scoped clinics`
    );
  }

  if (baseline) {
    const floor = (previous: number) => Math.floor(previous * COLLAPSE_RATIO);
    if (baseline.vinculos > 0 && summary.vinculos < floor(baseline.vinculos)) {
      reasons.push(
        `vínculos collapsed from ${baseline.vinculos} (${baseline.reference}) to ${summary.vinculos}`
      );
    }
    if (
      baseline.professionals > 0 &&
      summary.professionals < floor(baseline.professionals)
    ) {
      reasons.push(
        `professionals collapsed from ${baseline.professionals} (${baseline.reference}) to ${summary.professionals}`
      );
    }
  }

  return {
    decision: reasons.length > 0 ? "REFUSE" : "PROMOTE",
    reasons,
    baseline,
    summary,
    collapseRatio: COLLAPSE_RATIO,
  };
}

/**
 * Builds the `beforePromote` hook for one run.
 *
 * The report is written whether or not the run is refused — a promotion that
 * passed narrowly is exactly as interesting as one that failed.
 */
export function promotionGateFor(runId: number) {
  return async (summary: PromotionSummary): Promise<void> => {
    const baseline = await lastPromotedBaseline(runId);
    const validation = judgePromotion({ summary, baseline });

    await db
      .update(cnesRuns)
      .set({ phase: "VALIDATING", validationReport: validation })
      .where(eq(cnesRuns.id, runId));

    if (validation.decision === "REFUSE") {
      logger.error(
        "cnes.ingestion.promotion_refused",
        new Error(validation.reasons.join("; "))
      );
      throw new PromotionRefused(validation);
    }

    logger.info("cnes.ingestion.promotion_validated", {
      runId,
      vinculos: summary.vinculos,
      professionals: summary.professionals,
      baselineVinculos: baseline?.vinculos,
      baselineReference: baseline?.reference,
    });
  };
}
