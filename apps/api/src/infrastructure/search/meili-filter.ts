import { Role } from "@atlasmed/access";

export const MEILI_FILTER_MAX_LENGTH = 8_000;

const FILTER_FIELDS = [
  "id",
  "territoryIds",
  "territoryAssignmentStatus",
  "verticalIds",
  "specialtyNormalized",
  "activeFacilityIds",
  "activeTerritoryIds",
  "repUserIds",
  "verticalFunnelStages",
  "verticalPurchaseIntervalSources",
  "verticalManualPurchaseProfiles",
  "purchaseFunnelStagesAny",
  "unitTypeId",
  "legalDocumentType",
  "clinicalFocusIds",
] as const;

type FilterField = (typeof FILTER_FIELDS)[number];

type FilterClause = { expression: string };
type NumericFilterField =
  | "purchaseFunnelStageRank"
  | "purchaseIntervalDaysMin"
  | "hasLastValidPurchase"
  | "lastValidPurchaseSortAt";

function escapeValue(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("'", "\\'");
}

function quoted(value: string): string {
  return `'${escapeValue(value)}'`;
}

function formatFilterValue(value: string | number): string {
  return typeof value === "number" ? String(value) : quoted(value);
}

export function eqFilter(field: FilterField, value: string | number): FilterClause {
  return { expression: `${field} = ${formatFilterValue(value)}` };
}

export function inFilter(
  field: FilterField,
  values: Array<string | number>,
): FilterClause | undefined {
  const uniqueValues = [...new Set(values.map((v) => (typeof v === "number" ? v : v)))].sort(
    (a, b) => (typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b))),
  );
  if (uniqueValues.length === 0) return undefined;
  return {
    expression: `${field} IN [${uniqueValues.map(formatFilterValue).join(", ")}]`,
  };
}

/**
 * Every value must be present on the document — AND, not OR.
 *
 * On an array field Meili reads `f = 1 AND f = 2` as "contains 1 and contains
 * 2", which is what the SQL side means by requiring all selected clinical
 * focuses. `IN [1, 2]` would be "contains either" and would widen the result
 * set instead of narrowing it, matching the products/focuses asymmetry that
 * this whole filter audit started from.
 */
export function allOfFilter(
  field: FilterField,
  values: Array<string | number>,
): FilterClause | undefined {
  const uniqueValues = [...new Set(values)].sort((a, b) =>
    typeof a === "number" && typeof b === "number"
      ? a - b
      : String(a).localeCompare(String(b)),
  );
  if (uniqueValues.length === 0) return undefined;
  const expression = uniqueValues
    .map((value) => `${field} = ${formatFilterValue(value)}`)
    .join(" AND ");
  return {
    expression: uniqueValues.length === 1 ? expression : `(${expression})`,
  };
}

/**
 * Negates a clause.
 *
 * Written as `NOT (…)` rather than `!=` because the fields worth negating here
 * are arrays: on `activeFacilityIds`, `= 685` means "contains 685", so the
 * negation has to wrap the containment rather than compare against it.
 */
export function notFilter(clause: FilterClause | undefined): FilterClause | undefined {
  if (!clause) return undefined;
  return { expression: `NOT (${clause.expression})` };
}

export function isNullFilter(field: FilterField): FilterClause {
  return { expression: `${field} IS NULL` };
}

export function gteFilter(field: NumericFilterField, value: number): FilterClause {
  return { expression: `${field} >= ${value}` };
}

export function lteFilter(field: NumericFilterField, value: number): FilterClause {
  return { expression: `${field} <= ${value}` };
}

export type { FilterClause };

export function geoRadiusFilter(latitude: number, longitude: number, radiusMeters: number): FilterClause {
  return { expression: `_geoRadius(${latitude}, ${longitude}, ${radiusMeters})` };
}

export function orGroup(clauses: Array<FilterClause | undefined>): FilterClause | undefined {
  const present = clauses.filter((clause): clause is FilterClause => clause !== undefined);
  if (present.length === 0) return undefined;
  if (present.length === 1) return present[0];
  return {
    expression: `(${present.map((clause) => clause.expression).join(" OR ")})`,
  };
}

export function buildMeiliFilter(
  clauses: Array<FilterClause | undefined>,
  maxLength = MEILI_FILTER_MAX_LENGTH
): string | undefined {
  const expression = clauses
    .filter((clause): clause is FilterClause => clause !== undefined)
    .map((clause) => clause.expression)
    .join(" AND ");
  if (!expression) return undefined;
  return expression.length <= maxLength ? expression : undefined;
}

/**
 * Compact Meili pre-filter for facilities list search.
 * MANAGER → zone ids; REP → assignment user id; else facility id IN (OPS/legacy).
 * SQL hydrate remains authority.
 */
export function compactFacilityMeiliScopeFilter(input: {
  isGlobal: boolean;
  role: string;
  userId: number;
  oversightZoneIds?: number[];
  facilityIds: number[];
}): FilterClause | undefined {
  if (input.isGlobal) return undefined;

  if (input.role === Role.MANAGER) {
    const zones = input.oversightZoneIds ?? [];
    if (zones.length > 0) return inFilter("territoryIds", zones);
  }

  if (input.role === Role.REP) {
    return eqFilter("repUserIds", input.userId);
  }

  return input.facilityIds.length > 0
    ? inFilter("id", input.facilityIds)
    : eqFilter("id", -1);
}

/**
 * Compact Meili pre-filter for persons list search.
 * MANAGER → activeTerritoryIds; REP/OPS → activeFacilityIds IN (oversized → SQL).
 */
export function compactPersonMeiliScopeFilter(input: {
  isGlobal: boolean;
  role?: string;
  oversightZoneIds?: number[];
  facilityIds: number[];
}): FilterClause | undefined {
  if (input.isGlobal) return undefined;

  if (input.role === Role.MANAGER) {
    const zones = input.oversightZoneIds ?? [];
    if (zones.length > 0) return inFilter("activeTerritoryIds", zones);
  }

  return input.facilityIds.length > 0
    ? inFilter("activeFacilityIds", input.facilityIds)
    : eqFilter("activeFacilityIds", -1);
}
