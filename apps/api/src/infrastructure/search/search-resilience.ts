import { logger } from "../logging/logger";
import { metricsService } from "../monitoring/metrics.service";

export type SearchFallbackReason =
  | "filter_too_large"
  | "empty_hits"
  | "unparseable_ids"
  | "hydrate_drop"
  | "meili_error";

/** Meili is an accelerator — Postgres remains authority when search degrades. */
export function reportSearchMeiliFallback(
  index: "facilities" | "persons" | "facility_candidates",
  reason: SearchFallbackReason,
  detail?: Record<string, string | number | boolean>
): void {
  logger.warn("search.meili_fallback", { index, reason, ...detail });
  metricsService.recordSearchMeiliFallback(index, reason);
}
