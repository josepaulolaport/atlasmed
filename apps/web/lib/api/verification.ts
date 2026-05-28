import apiClient from "./client";
import type {
  VerificationConfirm,
  ChangeEmailRequest,
  ChangeEmailConfirmRequest,
  ChangePhoneRequest,
  ChangePhoneConfirmRequest,
} from "@/types/api";

export const verificationApi = {
  requestEmailVerification: async (): Promise<{ message: string }> => {
    const response = await apiClient.post("/access/verification/email/request");
    return response.data;
  },

  verifyEmail: async (data: VerificationConfirm): Promise<{ message: string }> => {
    const response = await apiClient.post("/access/verification/email/verify", data);
    return response.data;
  },

  requestPhoneVerification: async (): Promise<{ message: string }> => {
    const response = await apiClient.post("/access/verification/phone/request");
    return response.data;
  },

  verifyPhone: async (data: VerificationConfirm): Promise<{ message: string }> => {
    const response = await apiClient.post("/access/verification/phone/verify", data);
    return response.data;
  },

  requestEmailChange: async (data: ChangeEmailRequest): Promise<{ message: string }> => {
    const response = await apiClient.post("/access/verification/email/change", data);
    return response.data;
  },

  confirmEmailChange: async (data: ChangeEmailConfirmRequest): Promise<{ message: string }> => {
    const response = await apiClient.post("/access/verification/email/change/confirm", data);
    return response.data;
  },

  requestPhoneChange: async (data: ChangePhoneRequest): Promise<{ message: string }> => {
    const response = await apiClient.post("/access/verification/phone/change", data);
    return response.data;
  },

  confirmPhoneChange: async (data: ChangePhoneConfirmRequest): Promise<{ message: string }> => {
    const response = await apiClient.post("/access/verification/phone/change/confirm", data);
    return response.data;
  },
};
