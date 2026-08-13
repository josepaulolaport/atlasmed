import { ValidationError } from "../../../shared/errors";

const COMMERCIAL_STATUSES = ["UNREGISTERED", "REGISTERED", "SUSPENDED", "CLOSED"] as const;
const PURCHASE_FUNNEL_STAGES = ["NEVER_PURCHASED", "OUTSIDE_WINDOW", "PURCHASE_WINDOW", "CHURN", "INACTIVE"] as const;
const PURCHASE_PROFILES = ["AUTOMATIC", "WEEKLY", "BIWEEKLY", "MONTHLY", "BIMONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL", "CUSTOM"] as const;
const SORTS = ["relevance", "distance", "name", "purchaseFunnelStage", "purchaseIntervalDays", "lastPurchaseDate"] as const;
const ORDERS = ["asc", "desc"] as const;

/** Dashboard / Desempenho purchase buckets (matches countPurchaseBuckets SQL). */
const PURCHASE_BUCKETS = ["active", "inactive", "neverBought"] as const;

export type FacilityCommercialStatus = (typeof COMMERCIAL_STATUSES)[number];
export type FacilityPurchaseFunnelStage = (typeof PURCHASE_FUNNEL_STAGES)[number];
export type FacilityPurchaseProfileFilter = (typeof PURCHASE_PROFILES)[number];
export type FacilityPurchaseBucket = (typeof PURCHASE_BUCKETS)[number];
export type FacilitySearchSort = (typeof SORTS)[number];
export type FacilitySearchOrder = (typeof ORDERS)[number];

/**
 * Desempenho drill-down buckets → `facility_vertical_profiles.purchase_funnel_stage`.
 *
 * Stages ordered by time since the clinic last bought (`I` = purchase interval):
 * OUTSIDE_WINDOW (<0.5×I, bought recently) · PURCHASE_WINDOW (<2×I, due now) ·
 * CHURN (<3×I, overdue) · INACTIVE (≥3×I, lapsed) · NEVER_PURCHASED.
 *
 * So Ativas is the first two and Inativas the next two. The previous split put
 * OUTSIDE_WINDOW under Inativas and INACTIVE under "nunca compraram", which made
 * a clinic that bought last week read as inactive, and made a lapsed customer
 * indistinguishable from one that never bought at all.
 *
 * Must agree with `PurchaseBucketFilter` on mobile, which groups the per-stage
 * counts the dashboard now returns; tapping a donut slice drills in through
 * here, so a mismatch shows one number and lists a different set.
 */
export function purchaseBucketToFunnelFilter(bucket: FacilityPurchaseBucket): {
  stages: FacilityPurchaseFunnelStage[];
  includeNull: boolean;
} {
  switch (bucket) {
    case "active":
      return {
        stages: ["OUTSIDE_WINDOW", "PURCHASE_WINDOW"],
        includeNull: false,
      };
    case "inactive":
      return { stages: ["CHURN", "INACTIVE"], includeNull: false };
    case "neverBought":
      // Null = the funnel has not run for this profile yet, which reads as "no
      // purchase on record" rather than as a lapsed customer.
      return { stages: ["NEVER_PURCHASED"], includeNull: true };
  }
}

/** Reverse of [purchaseBucketToFunnelFilter] — null/unknown → neverBought. */
export function funnelStageToPurchaseBucket(
  stage: FacilityPurchaseFunnelStage | null | undefined,
): FacilityPurchaseBucket {
  switch (stage) {
    case "OUTSIDE_WINDOW":
    case "PURCHASE_WINDOW":
      return "active";
    case "CHURN":
    case "INACTIVE":
      return "inactive";
    case "NEVER_PURCHASED":
    case null:
    case undefined:
      return "neverBought";
    default:
      return "neverBought";
  }
}

export interface ListFacilitiesQuery {
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  commercialStatus?: FacilityCommercialStatus;
  /** Purchase-status bucket from Desempenho donut drill-down. */
  purchaseBucket?: FacilityPurchaseBucket;
  productIds?: number[];
  /** Clinical focus IDs — AND semantics (clinic must have all). */
  clinicalFocusIds?: number[];
  purchaseFunnelStages?: FacilityPurchaseFunnelStage[];
  purchaseProfile?: FacilityPurchaseProfileFilter;
  purchaseIntervalMinDays?: number;
  purchaseIntervalMaxDays?: number;
  sort: FacilitySearchSort;
  order: FacilitySearchOrder;
}

function parseInteger(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !/^\d+$/.test(value)) return Number.NaN;
  return Number(value);
}

export function parseListFacilitiesQuery(query: Record<string, unknown>): ListFacilitiesQuery {
  const latitude = query.latitude === undefined ? undefined : Number(query.latitude);
  const longitude = query.longitude === undefined ? undefined : Number(query.longitude);
  const radiusKm = query.radiusKm === undefined ? undefined : Number(query.radiusKm);
  const productIds = typeof query.productIds === "string"
    ? query.productIds
        .split(",")
        .map((id) => Number.parseInt(id.trim(), 10))
        .filter((id) => Number.isInteger(id) && id > 0)
    : undefined;
  const clinicalFocusIds = typeof query.clinicalFocusIds === "string"
    ? query.clinicalFocusIds
        .split(",")
        .map((id) => Number.parseInt(id.trim(), 10))
        .filter((id) => Number.isInteger(id) && id > 0)
    : undefined;
  const purchaseFunnelStages = typeof query.purchaseFunnelStage === "string"
    ? query.purchaseFunnelStage.split(",").map((stage) => stage.trim()).filter(Boolean)
    : undefined;
  const purchaseIntervalMinDays = parseInteger(query.purchaseIntervalMinDays);
  const purchaseIntervalMaxDays = parseInteger(query.purchaseIntervalMaxDays);
  const commercialStatus = query.commercialStatus;
  const purchaseBucket = query.purchaseBucket;
  const purchaseProfile = query.purchaseProfile;
  const requestedSort = query.sort;
  const requestedOrder = query.order;
  const hasSearch = typeof query.search === "string" && query.search.trim().length > 0;
  const sort = (requestedSort ?? (hasSearch ? "relevance" : "name")) as FacilitySearchSort;
  const order = (requestedOrder ?? (sort === "relevance" ? "desc" : "asc")) as FacilitySearchOrder;

  const issues: Array<{ field: string; message: string }> = [];
  if ((latitude === undefined) !== (longitude === undefined)) issues.push({ field: "coordinates", message: "latitude and longitude must be provided together" });
  if (latitude !== undefined && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) issues.push({ field: "latitude", message: "latitude must be between -90 and 90" });
  if (longitude !== undefined && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) issues.push({ field: "longitude", message: "longitude must be between -180 and 180" });
  if (radiusKm !== undefined && (!Number.isFinite(radiusKm) || radiusKm <= 0 || radiusKm > 500)) issues.push({ field: "radiusKm", message: "radiusKm must be greater than 0 and at most 500" });
  if (radiusKm !== undefined && latitude === undefined) issues.push({ field: "radiusKm", message: "latitude and longitude are required when radiusKm is provided" });
  if (commercialStatus !== undefined && (typeof commercialStatus !== "string" || !COMMERCIAL_STATUSES.includes(commercialStatus as FacilityCommercialStatus))) issues.push({ field: "commercialStatus", message: "commercialStatus is invalid" });
  if (
    purchaseBucket !== undefined &&
    (typeof purchaseBucket !== "string" ||
      !PURCHASE_BUCKETS.includes(purchaseBucket as FacilityPurchaseBucket))
  ) {
    issues.push({
      field: "purchaseBucket",
      message: "purchaseBucket must be active, inactive, or neverBought",
    });
  }
  if (query.productIds !== undefined && (!productIds || productIds.length === 0)) issues.push({ field: "productIds", message: "productIds must be a comma-separated list of product IDs" });
  if (query.clinicalFocusIds !== undefined && (!clinicalFocusIds || clinicalFocusIds.length === 0)) {
    issues.push({
      field: "clinicalFocusIds",
      message: "clinicalFocusIds must be a comma-separated list of positive integers",
    });
  }
  if (query.purchaseFunnelStage !== undefined && (!purchaseFunnelStages?.length || purchaseFunnelStages.some((stage) => !PURCHASE_FUNNEL_STAGES.includes(stage as FacilityPurchaseFunnelStage)))) issues.push({ field: "purchaseFunnelStage", message: "purchaseFunnelStage is invalid" });
  if (purchaseProfile !== undefined && (typeof purchaseProfile !== "string" || !PURCHASE_PROFILES.includes(purchaseProfile as FacilityPurchaseProfileFilter))) issues.push({ field: "purchaseProfile", message: "purchaseProfile is invalid" });
  if (purchaseIntervalMinDays !== undefined && (!Number.isInteger(purchaseIntervalMinDays) || purchaseIntervalMinDays < 1 || purchaseIntervalMinDays > 3650)) issues.push({ field: "purchaseIntervalMinDays", message: "purchaseIntervalMinDays must be an integer between 1 and 3650" });
  if (purchaseIntervalMaxDays !== undefined && (!Number.isInteger(purchaseIntervalMaxDays) || purchaseIntervalMaxDays < 1 || purchaseIntervalMaxDays > 3650)) issues.push({ field: "purchaseIntervalMaxDays", message: "purchaseIntervalMaxDays must be an integer between 1 and 3650" });
  if (purchaseIntervalMinDays !== undefined && purchaseIntervalMaxDays !== undefined && purchaseIntervalMinDays > purchaseIntervalMaxDays) issues.push({ field: "purchaseIntervalMinDays", message: "purchaseIntervalMinDays must be less than or equal to purchaseIntervalMaxDays" });
  if (requestedSort !== undefined && (typeof requestedSort !== "string" || !SORTS.includes(requestedSort as FacilitySearchSort))) issues.push({ field: "sort", message: "sort is invalid" });
  if (requestedOrder !== undefined && (typeof requestedOrder !== "string" || !ORDERS.includes(requestedOrder as FacilitySearchOrder))) issues.push({ field: "order", message: "order must be asc or desc" });
  if (sort === "relevance" && !hasSearch) issues.push({ field: "sort", message: "a nonblank search is required for relevance sort" });
  if (sort === "distance" && latitude === undefined) issues.push({ field: "sort", message: "latitude and longitude are required for distance sort" });
  if (issues.length > 0) throw new ValidationError(issues);

  return {
    latitude,
    longitude,
    radiusKm,
    commercialStatus: commercialStatus as FacilityCommercialStatus | undefined,
    purchaseBucket: purchaseBucket as FacilityPurchaseBucket | undefined,
    productIds,
    clinicalFocusIds,
    purchaseFunnelStages: purchaseFunnelStages as FacilityPurchaseFunnelStage[] | undefined,
    purchaseProfile: purchaseProfile as FacilityPurchaseProfileFilter | undefined,
    purchaseIntervalMinDays,
    purchaseIntervalMaxDays,
    sort,
    order,
  };
}
