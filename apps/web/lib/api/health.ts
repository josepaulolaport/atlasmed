import axios from "axios";
import type { HealthStatus } from "@/types/api";

// Health endpoints are NOT versioned, so use a separate client
const HEALTH_URL = process.env.NEXT_PUBLIC_HEALTH_URL || "http://localhost:3000";

const healthClient = axios.create({
  baseURL: HEALTH_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export const healthApi = {
  getHealth: async (): Promise<HealthStatus> => {
    const response = await healthClient.get<HealthStatus>("/health");
    return response.data;
  },

  getReadiness: async (): Promise<{ status: string }> => {
    const response = await healthClient.get("/health/ready");
    return response.data;
  },

  getLiveness: async (): Promise<{ status: string }> => {
    const response = await healthClient.get("/health/live");
    return response.data;
  },

  getMetrics: async (): Promise<string> => {
    const response = await healthClient.get<string>("/health/metrics");
    return response.data;
  },
};
