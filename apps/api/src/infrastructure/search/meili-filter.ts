export const MEILI_FILTER_MAX_LENGTH = 8_000;

const FILTER_FIELDS = [
  "id",
  "territoryIds",
  "territoryAssignmentStatus",
  "verticalIds",
  "specialtyNormalized",
  "activeFacilityIds",
  "activeTerritoryIds",
  "purchaseFunnelStage",
  "purchaseIntervalSource",
  "manualPurchaseProfile",
  "purchaseIntervalDays",
] as const;

type FilterField = (typeof FILTER_FIELDS)[number];

type FilterClause = { expression: string };
type NumericFilterField = "purchaseIntervalDays";

function escapeValue(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("'", "\\'");
}

function quoted(value: string): string {
  return `'${escapeValue(value)}'`;
}

export function eqFilter(field: FilterField, value: string): FilterClause {
  return { expression: `${field} = ${quoted(value)}` };
}

export function inFilter(field: FilterField, values: string[]): FilterClause | undefined {
  const uniqueValues = [...new Set(values)].sort();
  if (uniqueValues.length === 0) return undefined;
  return { expression: `${field} IN [${uniqueValues.map(quoted).join(", ")}]` };
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

export function geoRadiusFilter(latitude: number, longitude: number, radiusMeters: number): FilterClause {
  return { expression: `_geoRadius(${latitude}, ${longitude}, ${radiusMeters})` };
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
