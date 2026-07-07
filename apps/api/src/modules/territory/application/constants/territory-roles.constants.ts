import type { TerritoryTypeRecord } from "../interfaces/territory-type.repository.interface";

export const MANAGER_ZONE_TYPE_SLUG = "manager_zone";
export const REP_PATCH_TYPE_SLUG = "patch";

export function isManagerZoneType(type: { slug: string }): boolean {
  return type.slug === MANAGER_ZONE_TYPE_SLUG;
}

export function isRepPatchType(type: { assignsClinics: boolean }): boolean {
  return type.assignsClinics;
}

export function isGroupingHierarchyType(type: {
  participatesInGroupingHierarchy: boolean;
}): boolean {
  return type.participatesInGroupingHierarchy;
}

export function assertTerritoryTypeRoles(type: TerritoryTypeRecord): void {
  if (isManagerZoneType(type) && type.participatesInGroupingHierarchy) {
    throw new Error("Manager zone types cannot participate in grouping hierarchy");
  }

  if (isRepPatchType(type) && type.participatesInGroupingHierarchy) {
    throw new Error("Rep patch types cannot participate in grouping hierarchy");
  }
}
