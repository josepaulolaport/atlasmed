import type { TerritoryNodeType } from "@atlasmed/database";

/** Maps type slug to legacy Prisma enum value kept for backward compatibility. */
export const LEGACY_NODE_TYPE_BY_TYPE_SLUG: Record<string, TerritoryNodeType> = {
  country: "region",
  region: "region",
  state: "state",
  intermediate: "intermediate",
  patch: "patch",
};

export function legacyNodeTypeForTypeSlug(typeSlug: string): TerritoryNodeType {
  return LEGACY_NODE_TYPE_BY_TYPE_SLUG[typeSlug] ?? "intermediate";
}

const TERRITORY_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/;

export function normalizeTerritorySlug(slug: string): string {
  return slug.trim().toLowerCase();
}

export function validateTerritorySlug(slug: string): boolean {
  return TERRITORY_SLUG_PATTERN.test(slug);
}
