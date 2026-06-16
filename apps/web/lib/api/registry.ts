import apiClient from "./client";
import type { PaginatedResponse } from "@/types/api";
import type {
  ClinicDoctorListItem,
  DoctorClinicView,
  RegistryDemoResult,
  RegistrySuggestion,
} from "@/types/clinic";

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

export const clinicDoctorsApi = {
  listDoctors: async (
    clinicId: string,
    params?: {
      view?: DoctorClinicView;
      page?: number;
      limit?: number;
      search?: string;
    }
  ): Promise<PaginatedResponse<ClinicDoctorListItem>> => {
    const response = await apiClient.get<PaginatedResponse<ClinicDoctorListItem>>(
      `/clinic/clinics/${clinicId}/doctors`,
      { params }
    );
    return response.data;
  },

  confirmDoctor: async (clinicId: string, doctorId: string) => {
    const response = await apiClient.post(
      `/clinic/clinics/${clinicId}/doctors/${doctorId}/confirm`
    );
    return response.data;
  },

  associateDoctor: async (clinicId: string, doctorId: string) => {
    const response = await apiClient.post(
      `/clinic/clinics/${clinicId}/doctors/${doctorId}/associate`
    );
    return response.data;
  },

  endAssociation: async (clinicId: string, doctorId: string) => {
    const response = await apiClient.delete(
      `/clinic/clinics/${clinicId}/doctors/${doctorId}`
    );
    return response.data;
  },
};
