import apiClient from "./client";
import type { PaginatedResponse } from "@/types/api";
import type {
  Clinic,
  CreateClinicRequest,
  UpdateClinicRequest,
} from "@/types/clinic";

export const clinicsApi = {
  getClinics: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<PaginatedResponse<Clinic>> => {
    const response = await apiClient.get<PaginatedResponse<Clinic>>("/clinic/clinics", {
      params,
    });
    return response.data;
  },

  getClinic: async (id: string): Promise<Clinic> => {
    const response = await apiClient.get<Clinic>(`/clinic/clinics/${id}`);
    return response.data;
  },

  createClinic: async (data: CreateClinicRequest): Promise<Clinic> => {
    const response = await apiClient.post<Clinic>("/clinic/clinics", data);
    return response.data;
  },

  updateClinic: async (id: string, data: UpdateClinicRequest): Promise<Clinic> => {
    const response = await apiClient.patch<Clinic>(`/clinic/clinics/${id}`, data);
    return response.data;
  },

  deleteClinic: async (id: string): Promise<void> => {
    await apiClient.delete(`/clinic/clinics/${id}`);
  },
};
