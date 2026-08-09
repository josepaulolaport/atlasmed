import { ValidationError } from "../../../shared/errors";

const SORTS = ["name"] as const;
const ORDERS = ["asc", "desc"] as const;

export type HealthcareProfessionalSearchSort = (typeof SORTS)[number];
export type HealthcareProfessionalSearchOrder = (typeof ORDERS)[number];

export interface ListHealthcareProfessionalsQuery {
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  specialty?: string;
  sort: HealthcareProfessionalSearchSort;
  order: HealthcareProfessionalSearchOrder;
}

export function parseListHealthcareProfessionalsQuery(
  query: Record<string, unknown>
): ListHealthcareProfessionalsQuery {
  const latitude =
    query.latitude === undefined ? undefined : Number(query.latitude);
  const longitude =
    query.longitude === undefined ? undefined : Number(query.longitude);
  const radiusKm =
    query.radiusKm === undefined ? undefined : Number(query.radiusKm);
  const specialty =
    typeof query.specialty === "string" && query.specialty.trim()
      ? query.specialty.trim()
      : undefined;
  const requestedSort = query.sort;
  const requestedOrder = query.order;
  const sort = (requestedSort ?? "name") as HealthcareProfessionalSearchSort;
  const order = (requestedOrder ?? "asc") as HealthcareProfessionalSearchOrder;
  const issues: Array<{ field: string; message: string }> = [];

  if ((latitude === undefined) !== (longitude === undefined)) {
    issues.push({
      field: "coordinates",
      message: "latitude and longitude must be provided together",
    });
  }
  if (
    latitude !== undefined &&
    (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)
  ) {
    issues.push({
      field: "latitude",
      message: "latitude must be between -90 and 90",
    });
  }
  if (
    longitude !== undefined &&
    (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)
  ) {
    issues.push({
      field: "longitude",
      message: "longitude must be between -180 and 180",
    });
  }
  if (
    radiusKm !== undefined &&
    (!Number.isFinite(radiusKm) || radiusKm <= 0 || radiusKm > 500)
  ) {
    issues.push({
      field: "radiusKm",
      message: "radiusKm must be greater than 0 and at most 500",
    });
  }
  if (radiusKm !== undefined && latitude === undefined) {
    issues.push({
      field: "radiusKm",
      message: "latitude and longitude are required when radiusKm is provided",
    });
  }
  if (query.specialty !== undefined && !specialty) {
    issues.push({ field: "specialty", message: "specialty cannot be blank" });
  }
  if (
    requestedSort !== undefined &&
    (typeof requestedSort !== "string" ||
      !SORTS.includes(requestedSort as HealthcareProfessionalSearchSort))
  ) {
    issues.push({ field: "sort", message: "sort is invalid" });
  }
  if (
    requestedOrder !== undefined &&
    (typeof requestedOrder !== "string" ||
      !ORDERS.includes(requestedOrder as HealthcareProfessionalSearchOrder))
  ) {
    issues.push({ field: "order", message: "order must be asc or desc" });
  }
  if (issues.length > 0) throw new ValidationError(issues);

  return { latitude, longitude, radiusKm, specialty, sort, order };
}
