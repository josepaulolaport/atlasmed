import apiClient from "./client";
import type { PaginatedResponse } from "@/types/api";
import type {
  AddTerritoryRollupLinkRequest,
  ClinicTerritoryOverrideRequest,
  CreateTerritoryRequest,
  CreateTerritoryResult,
  CreateTerritoryTypeRequest,
  GeoJsonPolygon,
  RecomputeMembershipResponse,
  SubmitApprovalRequest,
  Territory,
  TerritoryApprovalRequest,
  TerritoryType,
  UpdateTerritoryTypeRequest,
  TerritoryDescendantsResponse,
  TerritoryGeoMembership,
  SaveBoundaryResponse,
  TerritoryRollupLink,
  TerritoryTreeNode,
  UnassignedClinic,
  UpdateTerritoryRequest,
} from "@/types/territory";

export const territoriesApi = {
  listTerritories: async (
    format: "tree" | "flat" = "flat"
  ): Promise<{ data: Territory[] | TerritoryTreeNode[] }> => {
    const response = await apiClient.get<{ data: Territory[] | TerritoryTreeNode[] }>(
      "/territory/territories",
      { params: { format } }
    );
    return response.data;
  },

  listAmbiguousParents: async (): Promise<{ data: Territory[] }> => {
    const response = await apiClient.get<{ data: Territory[] }>(
      "/territory/territories/ambiguous-parents"
    );
    return response.data;
  },

  listTerritoryTypes: async (): Promise<{ data: TerritoryType[] }> => {
    const response = await apiClient.get<{ data: TerritoryType[] }>("/territory/territory-types");
    return response.data;
  },

  createTerritoryType: async (data: CreateTerritoryTypeRequest): Promise<TerritoryType> => {
    const response = await apiClient.post<TerritoryType>("/territory/territory-types", data);
    return response.data;
  },

  updateTerritoryType: async (
    id: string,
    data: UpdateTerritoryTypeRequest
  ): Promise<TerritoryType> => {
    const response = await apiClient.patch<TerritoryType>(`/territory/territory-types/${id}`, data);
    return response.data;
  },

  getTerritory: async (id: string): Promise<Territory> => {
    const response = await apiClient.get<Territory>(`/territory/territories/${id}`);
    return response.data;
  },

  getDescendants: async (id: string): Promise<TerritoryDescendantsResponse> => {
    const response = await apiClient.get<TerritoryDescendantsResponse>(
      `/territory/territories/${id}/descendants`
    );
    return response.data;
  },

  createTerritory: async (
    data: CreateTerritoryRequest
  ): Promise<CreateTerritoryResult | TerritoryApprovalRequest> => {
    const response = await apiClient.post<CreateTerritoryResult | TerritoryApprovalRequest>(
      "/territory/territories",
      data
    );
    return response.data;
  },

  updateTerritory: async (
    id: string,
    data: UpdateTerritoryRequest
  ): Promise<Territory | TerritoryApprovalRequest> => {
    const response = await apiClient.patch<Territory | TerritoryApprovalRequest>(
      `/territory/territories/${id}`,
      data
    );
    return response.data;
  },

  deactivateTerritory: async (id: string): Promise<Territory> => {
    const response = await apiClient.delete<Territory>(`/territory/territories/${id}`);
    return response.data;
  },

  getBoundary: async (id: string): Promise<GeoJsonPolygon | null> => {
    const response = await apiClient.get<GeoJsonPolygon>(
      `/territory/territories/${id}/boundary`,
      { validateStatus: (status) => status === 200 || status === 204 }
    );
    if (response.status === 204) {
      return null;
    }
    return response.data;
  },

  saveBoundary: async (
    id: string,
    geoJson: GeoJsonPolygon
  ): Promise<SaveBoundaryResponse> => {
    const response = await apiClient.put<SaveBoundaryResponse>(
      `/territory/territories/${id}/boundary`,
      geoJson
    );
    return response.data;
  },

  deleteBoundary: async (id: string): Promise<{ success: boolean }> => {
    const response = await apiClient.delete<{ success: boolean }>(
      `/territory/territories/${id}/boundary`
    );
    return response.data;
  },

  recomputeMembership: async (): Promise<RecomputeMembershipResponse> => {
    const response = await apiClient.post<RecomputeMembershipResponse>(
      "/territory/territories/recompute-membership"
    );
    return response.data;
  },

  listUnassignedClinics: async (params?: {
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<UnassignedClinic>> => {
    const response = await apiClient.get<PaginatedResponse<UnassignedClinic>>(
      "/territory/territories/unassigned-clinics",
      { params }
    );
    return response.data;
  },

  overrideClinicTerritory: async (
    clinicId: string,
    data: ClinicTerritoryOverrideRequest
  ): Promise<{ success: boolean }> => {
    const response = await apiClient.patch<{ success: boolean }>(
      `/territory/clinics/${clinicId}/territory`,
      data
    );
    return response.data;
  },

  unlockClinicGeo: async (clinicId: string): Promise<{ success: boolean }> => {
    const response = await apiClient.post<{ success: boolean }>(
      `/territory/clinics/${clinicId}/territory/unlock-geo`
    );
    return response.data;
  },

  listApprovalRequests: async (params?: {
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{ items: TerritoryApprovalRequest[]; total: number }> => {
    const response = await apiClient.get<{
      items: TerritoryApprovalRequest[];
      total: number;
    }>("/territory/territories/approval-requests", { params });
    return response.data;
  },

  submitApprovalRequest: async (
    data: SubmitApprovalRequest
  ): Promise<TerritoryApprovalRequest> => {
    const response = await apiClient.post<TerritoryApprovalRequest>(
      "/territory/territories/approval-requests",
      data
    );
    return response.data;
  },

  approveRequest: async (
    id: string,
    note?: string
  ): Promise<TerritoryApprovalRequest> => {
    const response = await apiClient.post<TerritoryApprovalRequest>(
      `/territory/territories/approval-requests/${id}/approve`,
      { note }
    );
    return response.data;
  },

  rejectRequest: async (
    id: string,
    note?: string
  ): Promise<TerritoryApprovalRequest> => {
    const response = await apiClient.post<TerritoryApprovalRequest>(
      `/territory/territories/approval-requests/${id}/reject`,
      { note }
    );
    return response.data;
  },

  listRollupLinks: async (
    territoryId: string
  ): Promise<{ data: TerritoryRollupLink[] }> => {
    const response = await apiClient.get<{ data: TerritoryRollupLink[] }>(
      `/territory/territories/${territoryId}/rollup-links`
    );
    return response.data;
  },

  addRollupLink: async (
    territoryId: string,
    data: AddTerritoryRollupLinkRequest
  ): Promise<TerritoryRollupLink> => {
    const response = await apiClient.post<TerritoryRollupLink>(
      `/territory/territories/${territoryId}/rollup-links`,
      data
    );
    return response.data;
  },

  removeRollupLink: async (
    territoryId: string,
    linkId: string
  ): Promise<{ success: boolean }> => {
    const response = await apiClient.delete<{ success: boolean }>(
      `/territory/territories/${territoryId}/rollup-links/${linkId}`
    );
    return response.data;
  },

  listOperationalMembers: async (
    referenceTerritoryId: string
  ): Promise<{ data: TerritoryGeoMembership[] }> => {
    const response = await apiClient.get<{ data: TerritoryGeoMembership[] }>(
      `/territory/territories/${referenceTerritoryId}/operational-members`
    );
    return response.data;
  },

  listGeoMemberships: async (
    operationalTerritoryId: string
  ): Promise<{ data: TerritoryGeoMembership[] }> => {
    const response = await apiClient.get<{ data: TerritoryGeoMembership[] }>(
      `/territory/territories/${operationalTerritoryId}/geo-memberships`
    );
    return response.data;
  },

  getClippedBoundary: async (
    operationalTerritoryId: string,
    referenceTerritoryId: string
  ): Promise<GeoJsonPolygon | null> => {
    const response = await apiClient.get<GeoJsonPolygon | null>(
      `/territory/territories/${operationalTerritoryId}/clipped-boundary/${referenceTerritoryId}`
    );
    return response.data;
  },
};
