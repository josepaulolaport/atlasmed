import { ValidationError } from "../../../shared/errors";

const COMMERCIAL_STATUSES = ["REGISTERED", "ACTIVE", "SUSPENDED", "INACTIVE"] as const;
export type FacilityCommercialStatus = (typeof COMMERCIAL_STATUSES)[number];

export interface ListFacilitiesQuery {
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  commercialStatus?: FacilityCommercialStatus;
  productIds?: string[];
}

export function parseListFacilitiesQuery(query: Record<string, unknown>): ListFacilitiesQuery {
  const latitude = query.latitude === undefined ? undefined : Number(query.latitude);
  const longitude = query.longitude === undefined ? undefined : Number(query.longitude);
  const radiusKm = query.radiusKm === undefined ? undefined : Number(query.radiusKm);
  const productIds = typeof query.productIds === "string"
    ? query.productIds.split(",").map((id) => id.trim()).filter(Boolean)
    : undefined;
  const commercialStatus = query.commercialStatus;

  const issues: Array<{ field: string; message: string }> = [];
  if ((latitude === undefined) !== (longitude === undefined)) issues.push({ field: "coordinates", message: "latitude and longitude must be provided together" });
  if (latitude !== undefined && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) issues.push({ field: "latitude", message: "latitude must be between -90 and 90" });
  if (longitude !== undefined && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) issues.push({ field: "longitude", message: "longitude must be between -180 and 180" });
  if (radiusKm !== undefined && (!Number.isFinite(radiusKm) || radiusKm <= 0 || radiusKm > 500)) issues.push({ field: "radiusKm", message: "radiusKm must be greater than 0 and at most 500" });
  if (radiusKm !== undefined && latitude === undefined) issues.push({ field: "radiusKm", message: "latitude and longitude are required when radiusKm is provided" });
  if (commercialStatus !== undefined && (typeof commercialStatus !== "string" || !COMMERCIAL_STATUSES.includes(commercialStatus as FacilityCommercialStatus))) issues.push({ field: "commercialStatus", message: "commercialStatus is invalid" });
  if (query.productIds !== undefined && (!productIds || productIds.length === 0)) issues.push({ field: "productIds", message: "productIds must be a comma-separated list of product IDs" });
  if (issues.length > 0) throw new ValidationError(issues);

  return { latitude, longitude, radiusKm, commercialStatus: commercialStatus as FacilityCommercialStatus | undefined, productIds };
}
