import apiClient from "./client";
import type { PaginatedResponse } from "@/types/api";
import type {
  CreateDoctorRequest,
  Doctor,
  UpdateDoctorRequest,
} from "@/types/clinic";

export const doctorsApi = {
  getDoctors: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    clinicId?: string;
  }): Promise<PaginatedResponse<Doctor>> => {
    const response = await apiClient.get<PaginatedResponse<Doctor>>("/doctor/doctors", {
      params,
    });
    return response.data;
  },

  getDoctor: async (id: string): Promise<Doctor> => {
    const response = await apiClient.get<Doctor>(`/doctor/doctors/${id}`);
    return response.data;
  },

  createDoctor: async (data: CreateDoctorRequest): Promise<Doctor> => {
    const response = await apiClient.post<Doctor>("/doctor/doctors", data);
    return response.data;
  },

  updateDoctor: async (id: string, data: UpdateDoctorRequest): Promise<Doctor> => {
    const response = await apiClient.patch<Doctor>(`/doctor/doctors/${id}`, data);
    return response.data;
  },

  deleteDoctor: async (id: string): Promise<void> => {
    await apiClient.delete(`/doctor/doctors/${id}`);
  },
};
