import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { environment } from "@atlasmed/config";
import { isPublicAuthPath } from "@/lib/auth-routes";
import { isRefreshTokenReuseError } from "@/lib/api/errors";

const API_URL = environment.NEXT_PUBLIC_API_URL;

function isRefreshRequest(config: InternalAxiosRequestConfig): boolean {
  const url = config.url ?? "";
  const method = (config.method ?? "").toLowerCase();
  return url === "/session/" && method === "put";
}

function hadAuthorizationHeader(config: InternalAxiosRequestConfig): boolean {
  const headers = config.headers;
  if (!headers) {
    return false;
  }

  return Boolean(headers.Authorization ?? headers.authorization);
}

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

const ACCESS_TOKEN_STORAGE_KEY = "atlasmed_access_token";

function readStoredAccessToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
}

let accessToken: string | null = readStoredAccessToken();

export function setAccessToken(token: string | null): void {
  accessToken = token;

  if (typeof window === "undefined") {
    return;
  }

  if (token) {
    sessionStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
  } else {
    sessionStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  }
}

export function getAccessToken(): string | null {
  return accessToken;
}

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function subscribeTokenRefresh(callback: (token: string) => void) {
  refreshSubscribers.push(callback);
}

function onRefreshed(token: string) {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
}

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (error.response?.status === 429) {
      throw new Error("Muitas requisições. Tente novamente em instantes.");
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshRequest(originalRequest)) {
        isRefreshing = false;
        setAccessToken(null);
        return Promise.reject(error);
      }

      // Login/register and other unauthenticated calls legitimately return 401.
      if (!hadAuthorizationHeader(originalRequest)) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve) => {
          subscribeTokenRefresh((token: string) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            resolve(apiClient(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const response = await axios.put(
          `${API_URL}/session/`,
          {},
          { withCredentials: true }
        );

        const { session } = response.data;
        const newAccessToken = session.token as string;
        setAccessToken(newAccessToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }

        onRefreshed(newAccessToken);
        isRefreshing = false;

        return apiClient(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        setAccessToken(null);

        if (typeof window !== "undefined") {
          const loginUrl = isRefreshTokenReuseError(refreshError)
            ? "/login?reason=refresh_reuse"
            : "/login";

          if (!isPublicAuthPath(window.location.pathname)) {
            window.location.replace(loginUrl);
          }
        }

        return Promise.reject(refreshError);
      }
    }

    if (error.response?.status === 403) {
      throw new Error("Você não tem permissão para realizar esta ação.");
    }

    if (error.response?.status === 500) {
      throw new Error("Ocorreu um erro inesperado. Tente novamente mais tarde.");
    }

    return Promise.reject(error);
  }
);

export default apiClient;
