/**
 * AtlasMed priority specialty services (Ortopedia / Dermatologia).
 * Distinct from CNES numeric codes — linked from active vertical profiles
 * with `source_provider = atlasmed` so CNES reconcile does not delete them.
 */
export const PRIORITY_FACILITY_SERVICE_SOURCE = "atlasmed" as const;

/** Classification slot for vertical-derived specialty rows. */
export const PRIORITY_FACILITY_SERVICE_CLASSIFICATION = "000" as const;

export const PRIORITY_FACILITY_SERVICES = [
  {
    serviceCode: "AM-ORTOPEDIA",
    serviceName: "Ortopedia",
    verticalCode: "ORTOPEDIA",
    priorityRank: 0,
  },
  {
    serviceCode: "AM-DERMATOLOGIA",
    serviceName: "Dermatologia",
    verticalCode: "DERMATOLOGIA",
    priorityRank: 1,
  },
] as const;

export type PriorityFacilityServiceCode =
  (typeof PRIORITY_FACILITY_SERVICES)[number]["serviceCode"];

export const PRIORITY_FACILITY_SERVICE_CODES: readonly PriorityFacilityServiceCode[] =
  PRIORITY_FACILITY_SERVICES.map((row) => row.serviceCode);

export function isPriorityFacilityServiceCode(code: string): boolean {
  return (PRIORITY_FACILITY_SERVICE_CODES as readonly string[]).includes(
    code.trim(),
  );
}
