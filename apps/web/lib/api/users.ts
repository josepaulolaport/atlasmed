import apiClient from "./client";
import type {
  User,
  Invitation,
  InviteUserRequest,
  RoleInfo,
  UserAssignments,
} from "@/types/auth";
import type { PaginatedResponse } from "@/types/api";

export const usersApi = {
  getUsers: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }): Promise<PaginatedResponse<User>> => {
    const response = await apiClient.get<PaginatedResponse<User>>("/access/users", {
      params,
    });
    return response.data;
  },

  getRoles: async (): Promise<RoleInfo[]> => {
    const response = await apiClient.get<{ roles: RoleInfo[] }>("/access/roles");
    return response.data.roles;
  },

  inviteUser: async (data: InviteUserRequest): Promise<Invitation> => {
    const response = await apiClient.post<{ invite: Invitation }>("/access/invite", data);
    return response.data.invite;
  },

  revokeInvite: async (inviteId: string): Promise<void> => {
    await apiClient.delete(`/access/invites/${inviteId}`);
  },

  resendInvite: async (inviteId: string): Promise<Invitation> => {
    const response = await apiClient.post<{ invite: Invitation }>(
      `/access/invites/${inviteId}/resend`
    );
    return response.data.invite;
  },

  getInvitations: async (params?: {
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<Invitation>> => {
    const response = await apiClient.get<{
      invitations: Invitation[];
      pagination: PaginatedResponse<Invitation>["pagination"];
    }>("/access/invitations", { params });

    return {
      data: response.data.invitations,
      pagination: response.data.pagination,
    };
  },

  deactivateUser: async (userId: string): Promise<{ message: string }> => {
    const response = await apiClient.post<{ message: string }>(`/access/users/${userId}/deactivate`);
    return response.data;
  },

  activateUser: async (userId: string): Promise<{ message: string }> => {
    const response = await apiClient.post<{ message: string }>(`/access/users/${userId}/activate`);
    return response.data;
  },

  suspendUser: async (userId: string): Promise<{ message: string }> => {
    const response = await apiClient.post<{ message: string }>(`/access/users/${userId}/suspend`);
    return response.data;
  },

  unsuspendUser: async (userId: string): Promise<{ message: string }> => {
    const response = await apiClient.post<{ message: string }>(`/access/users/${userId}/unsuspend`);
    return response.data;
  },

  changeUserRole: async (userId: string, roleId: string): Promise<{ message: string }> => {
    const response = await apiClient.patch<{ message: string }>(`/access/users/${userId}/role`, {
      roleId,
    });
    return response.data;
  },

  getUserAssignments: async (userId: string): Promise<UserAssignments> => {
    const response = await apiClient.get<UserAssignments>(
      `/access/users/${userId}/assignments`
    );
    return response.data;
  },

  assignManager: async (
    userId: string,
    managerId: string | null
  ): Promise<{ message: string }> => {
    const response = await apiClient.patch<{ message: string }>(
      `/access/users/${userId}/manager`,
      { managerId }
    );
    return response.data;
  },

  assignTerritory: async (
    userId: string,
    territoryId: string
  ): Promise<{ message: string }> => {
    const response = await apiClient.post<{ message: string }>(
      `/access/users/${userId}/territories`,
      { territoryId }
    );
    return response.data;
  },

  revokeTerritory: async (
    userId: string,
    territoryId: string
  ): Promise<{ message: string }> => {
    const response = await apiClient.delete<{ message: string }>(
      `/access/users/${userId}/territories/${encodeURIComponent(territoryId)}`
    );
    return response.data;
  },

  getUserCapabilities: async (userId: string): Promise<{
    role: string;
    grants: import("@/types/auth").AccessGrant[];
  }> => {
    const response = await apiClient.get(`/access/users/${userId}/capabilities`);
    return response.data;
  },

  grantPermission: async (
    userId: string,
    data: {
      resource: string;
      action: string;
      resourceId?: string;
      expiresAt?: string;
    }
  ): Promise<{ grant: import("@/types/auth").AccessGrant; message: string }> => {
    const response = await apiClient.post(`/access/users/${userId}/permissions`, data);
    return response.data;
  },

  revokePermission: async (
    userId: string,
    data: {
      resource: string;
      action: string;
      resourceId?: string;
    }
  ): Promise<{ message: string }> => {
    const response = await apiClient.delete(`/access/users/${userId}/permissions`, {
      data,
    });
    return response.data;
  },
};
