import apiClient from "./client";
import type {
  FacilityProfessionalRole,
  ProfessionalFacilityContext,
  UpdateFacilityProfessionalInput,
} from "@atlasmed/access";
import type { PaginatedResponse } from "@/types/api";
import type { FacilityProfessionalListItem, FacilityProfessionalView } from "@/types/facility";

export const facilityProfessionalsApi = {
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
      `/facilities/${facilityId}/professionals`,
      { params }
    );
    return response.data;
  },

  getContext: async (
    facilityId: string,
    professionalId: string
  ): Promise<ProfessionalFacilityContext> => {
    const response = await apiClient.get<ProfessionalFacilityContext>(
      `/facilities/${facilityId}/professionals/${professionalId}`
    );
    return response.data;
  },

  updateRoles: async (
    facilityId: string,
    professionalId: string,
    data: UpdateFacilityProfessionalInput
  ): Promise<FacilityProfessionalRole> => {
    const response = await apiClient.patch<FacilityProfessionalRole>(
      `/facilities/${facilityId}/professionals/${professionalId}`,
      data
    );
    return response.data;
  },

  confirmProfessional: async (facilityId: string, professionalId: string) => {
    const response = await apiClient.post(
      `/facilities/${facilityId}/professionals/${professionalId}/confirm`
    );
    return response.data;
  },

  associateProfessional: async (facilityId: string, professionalId: string) => {
    const response = await apiClient.post(
      `/facilities/${facilityId}/professionals/${professionalId}/associate`
    );
    return response.data;
  },

  endAssociation: async (facilityId: string, professionalId: string) => {
    const response = await apiClient.delete(
      `/facilities/${facilityId}/professionals/${professionalId}`
    );
    return response.data;
  },
};

/** @deprecated Use facilityProfessionalsApi */
export const facilityDoctorsApi = {
  listProfessionals: facilityProfessionalsApi.listProfessionals,
  getContext: facilityProfessionalsApi.getContext,
  updateRoles: facilityProfessionalsApi.updateRoles,
  confirmDoctor: facilityProfessionalsApi.confirmProfessional,
  associateDoctor: facilityProfessionalsApi.associateProfessional,
  endAssociation: facilityProfessionalsApi.endAssociation,
};

/** @deprecated Use facilityProfessionalsApi */
export const clinicDoctorsApi = facilityDoctorsApi;
