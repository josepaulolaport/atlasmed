import apiClient from "./client";
import type { PaginatedResponse } from "@/types/api";
import type {
  CreateDoctorRequest,
  Professional,
  UpdateDoctorRequest,
} from "@/types/facility";

export const professionalsApi = {
  getProfessionals: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    facilityId?: string;
  }): Promise<PaginatedResponse<Professional>> => {
    const response = await apiClient.get<PaginatedResponse<Professional>>("/doctor/professionals", {
      params,
    });
    return response.data;
  },

  getProfessional: async (id: string): Promise<Professional> => {
    const response = await apiClient.get<Professional>(`/doctor/professionals/${id}`);
    return response.data;
  },

  createDoctor: async (data: CreateDoctorRequest): Promise<Professional> => {
    const response = await apiClient.post<Professional>("/doctor/professionals", data);
    return response.data;
  },

  updateDoctor: async (id: string, data: UpdateDoctorRequest): Promise<Professional> => {
    const response = await apiClient.patch<Professional>(`/doctor/professionals/${id}`, data);
    return response.data;
  },

  deleteDoctor: async (id: string): Promise<void> => {
    await apiClient.delete(`/doctor/professionals/${id}`);
  },
};
