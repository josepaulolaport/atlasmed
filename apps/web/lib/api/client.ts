import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { isPublicAuthPath } from "@/lib/auth-routes";
import { isRefreshTokenReuseError } from "@/lib/api/errors";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";

function isRefreshRequest(config: InternalAxiosRequestConfig): boolean {
  const url = config.url ?? "";
  return url.includes("/access/refresh");
}

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
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
      throw new Error("Too many requests. Please try again later.");
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshRequest(originalRequest)) {
        isRefreshing = false;
        setAccessToken(null);
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
        const response = await axios.post(
          `${API_URL}/access/refresh`,
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
      throw new Error("You don't have permission to perform this action.");
    }

    if (error.response?.status === 500) {
      throw new Error("An unexpected error occurred. Please try again later.");
    }

    return Promise.reject(error);
  }
);

export default apiClient;
