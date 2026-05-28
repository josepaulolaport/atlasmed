import type { AxiosError } from "axios";

type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
  };
};

export function getApiErrorCode(error: unknown): string | undefined {
  const axiosError = error as AxiosError<ApiErrorBody>;
  return axiosError.response?.data?.error?.code;
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  const axiosError = error as AxiosError<ApiErrorBody>;
  return axiosError.response?.data?.error?.message ?? fallback;
}

export function isRefreshTokenReuseError(error: unknown): boolean {
  return getApiErrorCode(error) === "REFRESH_TOKEN_REUSE_DETECTED";
}
