import apiClient from "./client";
import type { PaginatedResponse } from "@/types/api";
import type {
  Facility,
  CreateClinicRequest,
  UpdateClinicRequest,
  FacilityPurchaseProfileFilter,
  FacilitySort,
  FacilitySortOrder,
  PurchaseFunnelStage,
} from "@/types/facility";

export interface GetFacilitiesParams {
  page?: number;
  limit?: number;
  search?: string;
  purchaseFunnelStage?: PurchaseFunnelStage | PurchaseFunnelStage[];
  purchaseProfile?: FacilityPurchaseProfileFilter;
  purchaseIntervalMinDays?: number;
  purchaseIntervalMaxDays?: number;
  sort?: FacilitySort;
  order?: FacilitySortOrder;
  signal?: AbortSignal;
}

function serializeFacilitiesParams(params?: GetFacilitiesParams) {
  if (!params) return undefined;
  const serialized = Object.fromEntries(
    Object.entries(params).filter(([key]) => key !== "signal" && key !== "purchaseFunnelStage"),
  ) as Record<string, string | number | undefined>;
  serialized.purchaseFunnelStage = Array.isArray(params.purchaseFunnelStage)
    ? params.purchaseFunnelStage.join(",")
    : params.purchaseFunnelStage;
  return serialized;
}

export const facilitiesApi = {
  getFacilities: async (params?: GetFacilitiesParams): Promise<PaginatedResponse<Facility>> => {
    const response = await apiClient.get<PaginatedResponse<Facility>>("/facilities", {
      params: serializeFacilitiesParams(params),
      signal: params?.signal,
    });
    return response.data;
  },

  getFacility: async (id: string): Promise<Facility> => {
    const response = await apiClient.get<Facility>(`/facilities/${id}`);
    return response.data;
  },

  createFacility: async (data: CreateClinicRequest): Promise<Facility> => {
    const response = await apiClient.post<Facility>("/facilities", data);
    return response.data;
  },

  updateFacility: async (id: string, data: UpdateClinicRequest): Promise<Facility> => {
    const response = await apiClient.patch<Facility>(`/facilities/${id}`, data);
    return response.data;
  },

  deleteFacility: async (id: string): Promise<void> => {
    await apiClient.delete(`/facilities/${id}`);
  },
};

/** @deprecated Use facilitiesApi */
export const clinicsApi = {
  getFacilitys: facilitiesApi.getFacilities,
  getFacility: facilitiesApi.getFacility,
  createFacility: facilitiesApi.createFacility,
  updateFacility: facilitiesApi.updateFacility,
  deleteFacility: facilitiesApi.deleteFacility,
};
