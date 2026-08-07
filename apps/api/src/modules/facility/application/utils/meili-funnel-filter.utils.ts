import {
  inFilter,
  type FilterClause,
} from "../../../../infrastructure/search/meili-filter";
import type { FacilityPurchaseFunnelStage } from "../interfaces/facility.repository.interface";
import type { FacilityPurchaseProfileFilter } from "../list-facilities-query";

const AUTOMATIC_INTERVAL_SOURCES = ["DEFAULT", "CALCULATED"] as const;

function quoteMeiliString(value: string): string {
  return `'${value.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`;
}

function formatMeiliInList(values: string[]): string {
  return [...values].sort().map(quoteMeiliString).join(", ");
}

/** Scoped vertical V + stages S → verticalFunnelStages; else purchaseFunnelStagesAny. */
export function meiliFunnelStageFilter(
  verticalIds: number[] | undefined,
  stages: FacilityPurchaseFunnelStage[],
  options?: { includeNull?: boolean },
): FilterClause | undefined {
  if (stages.length === 0) return undefined;

  const scopedVerticalIds = verticalIds?.filter((id) => id > 0) ?? [];

  if (scopedVerticalIds.length === 1) {
    const verticalId = scopedVerticalIds[0]!;
    const tokens = stages.map((stage) => `${verticalId}:${stage}`);
    if (options?.includeNull) {
      return {
        expression: `(verticalFunnelStages IN [${formatMeiliInList(tokens)}] OR verticalIds NOT IN [${verticalId}])`,
      };
    }
    return inFilter("verticalFunnelStages", tokens);
  }

  if (options?.includeNull) {
    return {
      expression: `(purchaseFunnelStagesAny IN [${formatMeiliInList(stages)}] OR purchaseFunnelStagesAny IS NULL)`,
    };
  }
  return inFilter("purchaseFunnelStagesAny", stages);
}

export function meiliPurchaseProfileFilter(
  verticalIds: number[] | undefined,
  profile: FacilityPurchaseProfileFilter,
): FilterClause | undefined {
  const scopedVerticalIds = verticalIds?.filter((id) => id > 0) ?? [];

  if (profile === "AUTOMATIC") {
    if (scopedVerticalIds.length === 0) {
      return { expression: "verticalManualPurchaseProfiles IS EMPTY" };
    }
    const tokens = scopedVerticalIds.flatMap((verticalId) =>
      AUTOMATIC_INTERVAL_SOURCES.map((source) => `${verticalId}:${source}`),
    );
    return inFilter("verticalPurchaseIntervalSources", tokens);
  }

  if (scopedVerticalIds.length === 0) {
    return undefined;
  }

  const tokens = scopedVerticalIds.map((verticalId) => `${verticalId}:${profile}`);
  return inFilter("verticalManualPurchaseProfiles", tokens);
}
