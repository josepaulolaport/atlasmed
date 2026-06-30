import apiClient from "./client";
import type { PaginatedResponse } from "@/types/api";
import type {
  FacilityProfessionalListItem,
  FacilityProfessionalView,
  RegistryDemoResult,
  RegistrySuggestion,
} from "@/types/facility";

export const registryApi = {
  runIngestion: async () => {
    const response = await apiClient.post("/registry-ingestion/run");
    return response.data;
  },

  runDemoScenario: async (): Promise<RegistryDemoResult> => {
    const response = await apiClient.post<RegistryDemoResult>("/registry-ingestion/demo");
    return response.data;
  },

  getSuggestions: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    type?: string;
  }): Promise<PaginatedResponse<RegistrySuggestion>> => {
    const response = await apiClient.get<PaginatedResponse<RegistrySuggestion>>(
      "/registry-suggestions",
      { params }
    );
    return response.data;
  },

  approveSuggestion: async (id: string, resolutionNote?: string) => {
    const response = await apiClient.post(`/registry-suggestions/${id}/approve`, {
      resolutionNote,
    });
    return response.data;
  },

  rejectSuggestion: async (id: string, resolutionNote?: string) => {
    const response = await apiClient.post(`/registry-suggestions/${id}/reject`, {
      resolutionNote,
    });
    return response.data;
  },
};

export const facilityDoctorsApi = {
  listProfessionals: async (
    facilityId: string,
    params?: {
      view?: FacilityProfessionalView;
      page?: number;
      limit?: number;
      search?: string;
    }
  ): Promise<PaginatedResponse<FacilityProfessionalListItem>> => {
    const response = await apiClient.get<PaginatedResponse<FacilityProfessionalListItem>>(
      `/clinic/facilities/${facilityId}/professionals`,
      { params }
    );
    return response.data;
  },

  confirmDoctor: async (facilityId: string, professionalId: string) => {
    const response = await apiClient.post(
      `/clinic/facilities/${facilityId}/professionals/${professionalId}/confirm`
    );
    return response.data;
  },

  associateDoctor: async (facilityId: string, professionalId: string) => {
    const response = await apiClient.post(
      `/clinic/facilities/${facilityId}/professionals/${professionalId}/associate`
    );
    return response.data;
  },

  endAssociation: async (facilityId: string, professionalId: string) => {
    const response = await apiClient.delete(
      `/clinic/facilities/${facilityId}/professionals/${professionalId}`
    );
    return response.data;
  },
};
