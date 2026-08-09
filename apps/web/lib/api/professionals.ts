import apiClient from "./client";
import type {
  CreateProfessionalInput,
  ProfessionalProfile,
  UpdateProfessionalInput,
} from "@atlasmed/access";
import type { PaginatedResponse } from "@/types/api";

export interface ProfessionalListItem {
  id: number;
  firstName: string;
  lastName: string;
  fullName?: string;
  specialty?: string;
  primarySpecialtyLabel?: string;
  crmNumber?: string;
  crmState?: string;
  facilityIds: number[];
  createdAt: string;
  updatedAt: string;
}

export const professionalsApi = {
  getProfessionals: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    facilityId?: string;
  }): Promise<PaginatedResponse<ProfessionalListItem>> => {
    const response = await apiClient.get<PaginatedResponse<ProfessionalListItem>>(
      "/professionals",
      { params }
    );
    return response.data;
  },

  getProfessional: async (id: string | number): Promise<ProfessionalProfile> => {
    const response = await apiClient.get<ProfessionalProfile>(`/professionals/${id}`);
    return response.data;
  },

  createProfessional: async (data: CreateProfessionalInput): Promise<ProfessionalProfile> => {
    const response = await apiClient.post<ProfessionalProfile>("/professionals", data);
    return response.data;
  },

  updateProfessional: async (
    id: string | number,
    data: UpdateProfessionalInput
  ): Promise<ProfessionalProfile> => {
    const response = await apiClient.patch<ProfessionalProfile>(`/professionals/${id}`, data);
    return response.data;
  },

  deleteProfessional: async (id: string | number): Promise<void> => {
    await apiClient.delete(`/professionals/${id}`);
  },
};

/** @deprecated Use professionalsApi */
export const doctorsApi = {
  getProfessionals: professionalsApi.getProfessionals,
  getProfessional: professionalsApi.getProfessional,
  createDoctor: professionalsApi.createProfessional,
  updateDoctor: professionalsApi.updateProfessional,
  deleteDoctor: professionalsApi.deleteProfessional,
};
