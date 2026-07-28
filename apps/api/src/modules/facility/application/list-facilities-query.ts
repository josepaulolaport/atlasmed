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
 * Desempenho donut buckets → `facilities.purchase_funnel_stage`.
 * Keep in sync with `DrizzleDashboardRepository.countPurchaseBuckets`.
 */
export function purchaseBucketToFunnelFilter(bucket: FacilityPurchaseBucket): {
  stages: FacilityPurchaseFunnelStage[];
  includeNull: boolean;
} {
  switch (bucket) {
    case "active":
      return { stages: ["PURCHASE_WINDOW"], includeNull: false };
    case "inactive":
      return {
        stages: ["OUTSIDE_WINDOW", "CHURN"],
        includeNull: false,
      };
    case "neverBought":
      return {
        stages: ["NEVER_PURCHASED", "INACTIVE"],
        includeNull: true,
      };
  }
}

export interface ListFacilitiesQuery {
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  commercialStatus?: FacilityCommercialStatus;
  /** Purchase-status bucket from Desempenho donut drill-down. */
  purchaseBucket?: FacilityPurchaseBucket;
  productIds?: string[];
  serviceCodes?: string[];
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
    ? query.productIds.split(",").map((id) => id.trim()).filter(Boolean)
    : undefined;
  const serviceCodes = typeof query.serviceCodes === "string"
    ? query.serviceCodes.split(",").map((id) => id.trim()).filter(Boolean)
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
  if (query.serviceCodes !== undefined && (!serviceCodes || serviceCodes.length === 0)) issues.push({ field: "serviceCodes", message: "serviceCodes must be a comma-separated list of CNES service codes" });
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
    serviceCodes,
    purchaseFunnelStages: purchaseFunnelStages as FacilityPurchaseFunnelStage[] | undefined,
    purchaseProfile: purchaseProfile as FacilityPurchaseProfileFilter | undefined,
    purchaseIntervalMinDays,
    purchaseIntervalMaxDays,
    sort,
    order,
  };
}
