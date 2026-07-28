import type { PurchaseRecurrenceSnapshot } from "@atlasmed/facility-insights";
import type { FacilityPurchaseFunnelStage } from "../interfaces/facility.repository.interface";

/** Urgency for facility rollup / Meili (higher = more actionable for reps). */
const FUNNEL_URGENCY: Record<FacilityPurchaseFunnelStage, number> = {
  PURCHASE_WINDOW: 5,
  CHURN: 4,
  OUTSIDE_WINDOW: 3,
  INACTIVE: 2,
  NEVER_PURCHASED: 1,
};

export type ProfileFunnelRollupSource = {
  purchaseFunnelStage: FacilityPurchaseFunnelStage;
  observedPurchaseIntervalDays: number | null;
  purchaseIntervalDays: number;
  purchaseIntervalSource: PurchaseRecurrenceSnapshot["purchaseIntervalSource"];
  manualPurchaseProfile: PurchaseRecurrenceSnapshot["manualPurchaseProfile"];
  manualPurchaseIntervalDays: number | null;
  lastValidPurchaseDate: string | null;
  purchaseRecurrenceSampleSize: number;
  nextPurchaseFunnelTransitionDate: string | null;
};

/** Pick most actionable profile snapshot for facility-level Meili rollup. */
export function pickFacilityFunnelRollup(
  profiles: ProfileFunnelRollupSource[],
): ProfileFunnelRollupSource | null {
  if (profiles.length === 0) return null;
  return profiles.reduce((best, next) => {
    const bestU = FUNNEL_URGENCY[best.purchaseFunnelStage] ?? 0;
    const nextU = FUNNEL_URGENCY[next.purchaseFunnelStage] ?? 0;
    if (nextU > bestU) return next;
    if (nextU < bestU) return best;
    // Tie-break: most recent last purchase.
    const bestLast = best.lastValidPurchaseDate ?? "";
    const nextLast = next.lastValidPurchaseDate ?? "";
    return nextLast > bestLast ? next : best;
  });
}
