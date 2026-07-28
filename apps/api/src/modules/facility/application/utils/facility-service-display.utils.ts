import type { FacilityService } from "../interfaces/facility.repository.interface";
import { PRIORITY_FACILITY_SERVICES } from "../constants/priority-facility-services";

/** Lower rank = higher chip priority (orthopedics / dermatology first). */
export function facilityServicePriorityRank(
  service: Pick<FacilityService, "serviceCode" | "serviceName">,
): number {
  const code = service.serviceCode.trim();
  const name = service.serviceName
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();

  const priority = PRIORITY_FACILITY_SERVICES.find(
    (row) => row.serviceCode === code,
  );
  if (priority) return priority.priorityRank;

  if (
    code === "155" ||
    name.includes("ortopedia") ||
    name.includes("traumatologia")
  ) {
    return 0;
  }
  if (name.includes("dermatolog")) {
    return 1;
  }
  return 50;
}

export function compareFacilityServices(
  a: Pick<FacilityService, "serviceCode" | "serviceName">,
  b: Pick<FacilityService, "serviceCode" | "serviceName">,
): number {
  const rank = facilityServicePriorityRank(a) - facilityServicePriorityRank(b);
  if (rank !== 0) return rank;
  return a.serviceName.localeCompare(b.serviceName, "pt-BR");
}
