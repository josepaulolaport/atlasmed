import apiClient from "./client";
import type { PaginatedResponse } from "@/types/api";
import type {
  Facility,
  CreateClinicRequest,
  UpdateClinicRequest,
} from "@/types/facility";

export const facilitysApi = {
  getFacilitys: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<PaginatedResponse<Facility>> => {
    const response = await apiClient.get<PaginatedResponse<Facility>>("/clinic/facilities", {
      params,
    });
    return response.data;
  },

  getFacility: async (id: string): Promise<Facility> => {
    const response = await apiClient.get<Facility>(`/clinic/facilities/${id}`);
    return response.data;
  },

  createFacility: async (data: CreateClinicRequest): Promise<Facility> => {
    const response = await apiClient.post<Facility>("/clinic/facilities", data);
    return response.data;
  },

  updateFacility: async (id: string, data: UpdateClinicRequest): Promise<Facility> => {
    const response = await apiClient.patch<Facility>(`/clinic/facilities/${id}`, data);
    return response.data;
  },

  deleteFacility: async (id: string): Promise<void> => {
    await apiClient.delete(`/clinic/facilities/${id}`);
  },
};
