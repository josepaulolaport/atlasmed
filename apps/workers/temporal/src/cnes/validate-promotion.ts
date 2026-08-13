import { eq } from "drizzle-orm";
import { cnesRuns } from "@atlasmed/database";
import type { PromotionSummary } from "@atlasmed/cnes-ingestion";
import { db } from "../infrastructure/db";
import { logger } from "../logger";

/**
 * The check `cnes_run_phase.VALIDATING` and `validation_report` were always for:
 * **did this import work**, asked of the import alone.
 *
 * It deliberately does **not** compare against previous runs. An earlier version
 * refused a load whose counts fell below half the last promoted run, on the
 * theory that a collapse meant a broken export. It does not: a clinic's roster
 * changes substantially month to month, so that rule would refuse good data,
 * and the only way past it would be an override nobody has written. Comparing to
 * history measures change and reports it as corruption.
 *
 * What can be asserted without history is that the run read what it was supposed
 * to read and wrote what it read. Truncation is already impossible upstream —
 * the archive is verified structurally before any of it is parsed, and every
 * entry read consumes exactly its declared compressed size — so what is left to
 * check here is that the load reached a sane end state and that its own numbers
 * reconcile.
 */

export interface ImportValidation {
  decision: "PROMOTE" | "REFUSE";
  reasons: string[];
  summary: PromotionSummary;
}

export class PromotionRefused extends Error {
  constructor(readonly validation: ImportValidation) {
    super(`refusing to promote the CNES snapshot: ${validation.reasons.join("; ")}`);
    this.name = "PromotionRefused";
  }
}

/**
 * Judges one import on its own terms.
 *
 * Every rule here describes a run that cannot be right, rather than a run that
 * looks different from last time.
 */
export function judgeImport(summary: PromotionSummary): ImportValidation {
  const reasons: string[] = [];

  // Nothing was in scope, so this run has nothing to say about any clinic — and
  // replacing every roster from it would be pure deletion.
  if (summary.scopedFacilities === 0) {
    reasons.push("no facility carries a cnes_code, so there is nothing to import");
  }

  // Our clinics were in scope and not one of them appears in the export. Every
  // `cnes_code` being wrong at once is not plausible; a changed export layout is.
  if (summary.scopedFacilities > 0 && summary.facilitiesUpserted === 0) {
    reasons.push(
      `none of the ${summary.scopedFacilities} scoped clinics were found in the export`
    );
  }

  // Clinics resolved, and yet not one professional was linked to any of them.
  // That is a broken read or a changed export, not a month in which nobody works.
  if (summary.facilitiesUpserted > 0 && summary.vinculos === 0) {
    reasons.push(
      `the export yielded no facility↔professional rows for ${summary.facilitiesUpserted} clinics`
    );
  }

  // Vínculos were built but no professional was written — the two halves of the
  // load disagree, and every one of those rows would dangle.
  if (summary.vinculos > 0 && summary.professionals === 0) {
    reasons.push(
      `${summary.vinculos} vínculos were built but no professional was upserted`
    );
  }

  // A registration is what makes a professional resolvable — it is the join key
  // the whole feature rests on. People without one are dropped by the loader, so
  // people written with none at all means registration parsing broke.
  if (summary.professionals > 0 && summary.registrations === 0) {
    reasons.push(
      `${summary.professionals} professionals were written without a single council registration`
    );
  }

  return {
    decision: reasons.length > 0 ? "REFUSE" : "PROMOTE",
    reasons,
    summary,
  };
}

/**
 * Builds the `beforePromote` hook for one run.
 *
 * The report is written either way — a run that passed is as worth inspecting as
 * one that did not, and it is the only record of what the load actually
 * produced before the roster was replaced.
 */
export function promotionGateFor(runId: number) {
  return async (summary: PromotionSummary): Promise<void> => {
    const validation = judgeImport(summary);

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

    logger.info("cnes.ingestion.import_validated", {
      runId,
      scopedFacilities: summary.scopedFacilities,
      professionals: summary.professionals,
      vinculos: summary.vinculos,
    });
  };
}
