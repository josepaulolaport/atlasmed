import apiClient from "./client";
import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RefreshTokenResponse,
  PasswordResetRequest,
  PasswordResetConfirm,
  User,
  Session,
  CapabilitiesResponse,
} from "@/types/auth";

export const authApi = {
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await apiClient.post<LoginResponse>("/access/login", data);
    return response.data;
  },

  register: async (data: RegisterRequest): Promise<LoginResponse> => {
    const response = await apiClient.post<LoginResponse>("/access/register", data);
    return response.data;
  },

  logout: async (): Promise<void> => {
    // Backend gets sessionId from the auth context, no body needed
    await apiClient.post("/access/logout");
  },

  refreshToken: async (): Promise<RefreshTokenResponse> => {
    // Refresh token is sent automatically via HTTP-only cookie
    const response = await apiClient.post<RefreshTokenResponse>("/access/refresh", {});
    return response.data;
  },

  requestPasswordReset: async (data: PasswordResetRequest): Promise<{ message: string }> => {
    const response = await apiClient.post("/access/password-reset/request", data);
    return response.data;
  },

  resetPassword: async (data: PasswordResetConfirm): Promise<{ message: string }> => {
    const response = await apiClient.post("/access/password-reset/confirm", data);
    return response.data;
  },

  getProfile: async (): Promise<User> => {
    const response = await apiClient.get<User>("/access/profile");
    return response.data;
  },

  updateProfile: async (data: Partial<User>): Promise<User> => {
    const response = await apiClient.patch<User>("/access/profile", data);
    return response.data;
  },

  getSessions: async (): Promise<Session[]> => {
    const response = await apiClient.get<{ sessions: Session[] }>("/access/sessions");
    return response.data.sessions;
  },

  revokeSession: async (sessionId: string): Promise<void> => {
    await apiClient.delete(`/access/sessions/${sessionId}`);
  },

  revokeOtherSessions: async (): Promise<{ revokedCount: number }> => {
    const response = await apiClient.post<{ revokedCount: number }>(
      "/access/sessions/revoke-others"
    );
    return response.data;
  },

  validateInviteToken: async (token: string): Promise<{
    email?: string;
    phoneNumber?: string;
    role: { id: string; name: string };
    expiresAt: string;
  }> => {
    const response = await apiClient.get(`/access/invite/${encodeURIComponent(token)}`);
    return response.data;
  },

  verify2FALogin: async (data: {
    pendingToken: string;
    code: string;
  }): Promise<LoginResponse> => {
    const response = await apiClient.post<LoginResponse>("/access/login/2fa", data);
    return response.data;
  },

  changePassword: async (data: {
    currentPassword: string;
    newPassword: string;
    revokeOtherSessions?: boolean;
  }): Promise<{ success: boolean }> => {
    const response = await apiClient.patch<{ success: boolean }>("/access/password", data);
    return response.data;
  },

  getCapabilities: async (): Promise<CapabilitiesResponse> => {
    const response = await apiClient.get<CapabilitiesResponse>(
      "/access/me/capabilities"
    );
    return response.data;
  },

  setup2FA: async (): Promise<{ secret: string; otpauthUrl: string }> => {
    const response = await apiClient.post<{ secret: string; otpauthUrl: string }>(
      "/access/2fa/setup"
    );
    return response.data;
  },

  confirm2FA: async (data: { code: string }): Promise<{ success: boolean }> => {
    const response = await apiClient.post<{ success: boolean }>(
      "/access/2fa/confirm",
      data
    );
    return response.data;
  },

  disable2FA: async (data: {
    password: string;
    code: string;
  }): Promise<{ success: boolean }> => {
    const response = await apiClient.post<{ success: boolean }>(
      "/access/2fa/disable",
      data
    );
    return response.data;
  },
};
