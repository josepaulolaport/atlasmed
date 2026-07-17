export const MANAGER_ZONE_TYPE_SLUG = "manager_zone";
export const REP_PATCH_TYPE_SLUG = "patch";

export function isManagerZoneType(type: { slug: string }): boolean {
  return type.slug === MANAGER_ZONE_TYPE_SLUG;
}

export function isRepPatchType(type: { assignsClinics: boolean }): boolean {
  return type.assignsClinics;
}
