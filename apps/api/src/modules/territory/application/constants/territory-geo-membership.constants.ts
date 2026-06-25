/** Minimum share of operational area inside a reference region to store membership. */
export const GEO_MEMBERSHIP_MIN_OVERLAP_RATIO = 0.01;

/** Reference territory types indexed for operational patch membership. */
export const GEO_MEMBERSHIP_REFERENCE_TYPE_SLUGS = ["state", "intermediate"] as const;

/** Official geography layers that keep manual tree parents (no geo auto-parent). */
export const REFERENCE_GEOGRAPHY_TYPE_SLUGS = [
  "country",
  "region",
  "state",
  "intermediate",
] as const;

export type GeoMembershipReferenceTypeSlug =
  (typeof GEO_MEMBERSHIP_REFERENCE_TYPE_SLUGS)[number];

export function isOperationalTerritoryType(type: { assignsClinics: boolean }): boolean {
  return type.assignsClinics;
}

export function isReferenceMembershipTarget(type: { slug: string }): boolean {
  return (GEO_MEMBERSHIP_REFERENCE_TYPE_SLUGS as readonly string[]).includes(type.slug);
}

export function isReferenceGeographyType(type: {
  slug: string;
  isCountryLevel: boolean;
}): boolean {
  return (
    type.isCountryLevel ||
    (REFERENCE_GEOGRAPHY_TYPE_SLUGS as readonly string[]).includes(type.slug)
  );
}
