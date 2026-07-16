import apiClient from "./client";
import type { PaginatedResponse } from "@/types/api";
import type { Facility, CreateClinicRequest, UpdateClinicRequest, Interaction, CreateInteractionInput } from "@/types/facility";

export const facilitiesApi = {
  getFacilities: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<PaginatedResponse<Facility>> => {
    const response = await apiClient.get<PaginatedResponse<Facility>>("/facilities", {
      params,
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

  listInteractions: async (
    facilityId: string,
    params?: { page?: number; limit?: number },
  ): Promise<PaginatedResponse<Interaction>> => {
    const response = await apiClient.get<PaginatedResponse<Interaction>>(
      `/facilities/${facilityId}/interactions`,
      { params },
    );
    return response.data;
  },

  createInteraction: async (
    facilityId: string,
    data: CreateInteractionInput,
  ): Promise<Interaction> => {
    const response = await apiClient.post<Interaction>(
      `/facilities/${facilityId}/interactions`,
      data,
    );
    return response.data;
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
