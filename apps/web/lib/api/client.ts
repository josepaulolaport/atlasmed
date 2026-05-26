import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from "axios";

// API v1 endpoint (versioned)
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

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
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("accessToken");
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
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
        // Backend uses HTTP-only cookies for refresh tokens
        // Just call the refresh endpoint and let the cookie be sent automatically
        const response = await axios.post(
          `${API_URL}/access/refresh`, // API_URL already includes /api/v1
          {},
          {
            withCredentials: true,
          }
        );

        const { session } = response.data;
        const accessToken = session.token;

        localStorage.setItem("accessToken", accessToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        }

        onRefreshed(accessToken);
        isRefreshing = false;

        return apiClient(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        localStorage.removeItem("accessToken");
        localStorage.removeItem("user");
        
        if (typeof window !== "undefined") {
          window.location.href = "/login";
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
