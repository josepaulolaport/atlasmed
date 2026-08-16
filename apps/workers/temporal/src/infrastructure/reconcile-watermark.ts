import {
  reconcileWatermark,
  type AnyDatabase,
  type ReconcileWatermarkName,
} from "@atlasmed/database";
import { eq, sql } from "drizzle-orm";

/**
 * How far an hourly reconciler has actually covered.
 *
 * Both reconcilers used to take their window as a fixed lookback from the run's
 * own start. Under overlap policy `SKIP` that loses data with no signal: a run
 * that overruns causes the next firings to be skipped, and the run that does
 * fire looks back the same fixed amount from *itself*, so the hours in between
 * belong to nobody. Reading a stored watermark instead means a skipped or failed
 * window is re-covered rather than stepped over.
 *
 * Shared because both reconcilers need the same rule and the purchase funnel's
 * copy would otherwise be the only one that got it right.
 */

/** The lookback used before a watermark exists — twice the schedule interval. */
export const DEFAULT_RECONCILE_LOOKBACK_HOURS = 2;

/**
 * Past this, re-cover everything instead of widening the window.
 *
 * A worker down for a day leaves a watermark far enough behind that the
 * incremental query stops being the cheap one, and a very wide window is also
 * the case where being slow matters most. Sweeping is bounded work with the same
 * outcome — so callers that have a sweep should take it.
 */
export const MAX_RECONCILE_WINDOW_HOURS = 24;

export interface ReconcileWindowPlan {
  since: string;
  /** The window is too wide to be worth running incrementally. */
  fullSweep: boolean;
}

export function planReconcileWindow(input: {
  coveredUntil: string | null;
  until: string;
  lookbackHours?: number;
  maxWindowHours?: number;
}): ReconcileWindowPlan {
  const until = Date.parse(input.until);
  const lookbackHours = input.lookbackHours ?? DEFAULT_RECONCILE_LOOKBACK_HOURS;
  const maxWindowHours = input.maxWindowHours ?? MAX_RECONCILE_WINDOW_HOURS;
  const fallback = new Date(until - lookbackHours * 3_600_000).toISOString();

  if (input.coveredUntil === null) return { since: fallback, fullSweep: false };

  const covered = Date.parse(input.coveredUntil);
  // A watermark ahead of this run means a later run already committed — take the
  // fallback rather than an empty or inverted window.
  if (!Number.isFinite(covered) || covered >= until) {
    return { since: fallback, fullSweep: false };
  }
  if (until - covered > maxWindowHours * 3_600_000) {
    return { since: new Date(covered).toISOString(), fullSweep: true };
  }
  // Never *narrower* than the fallback: overlap is free and cheap, and it covers
  // a row committed just after a run read its window.
  return {
    since: covered < Date.parse(fallback) ? new Date(covered).toISOString() : fallback,
    fullSweep: false,
  };
}

export async function readCoveredUntil(
  database: AnyDatabase,
  name: ReconcileWatermarkName,
): Promise<string | null> {
  const [row] = await database
    .select({ coveredUntil: reconcileWatermark.coveredUntil })
    .from(reconcileWatermark)
    .where(eq(reconcileWatermark.name, name))
    .limit(1);
  return row?.coveredUntil ? row.coveredUntil.toISOString() : null;
}

export async function commitCoveredUntil(
  database: AnyDatabase,
  name: ReconcileWatermarkName,
  until: string,
): Promise<void> {
  await database
    .insert(reconcileWatermark)
    .values({ name, coveredUntil: new Date(until) })
    .onConflictDoUpdate({
      target: reconcileWatermark.name,
      // Never backwards. Two schedules can commit for one reconciler, and the
      // slower one can finish after a run that started later.
      set: {
        coveredUntil: sql`greatest(${reconcileWatermark.coveredUntil}, excluded.covered_until)`,
        updatedAt: new Date(),
      },
    });
}
