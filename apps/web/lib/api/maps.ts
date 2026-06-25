import apiClient from "./client";

export interface GeocodeResult {
  longitude: number;
  latitude: number;
  fullAddress?: string;
  name?: string;
  mapboxId?: string;
}

export interface MapsConfig {
  configured: boolean;
  publicToken?: string;
  username: string;
}

export const mapsApi = {
  async getConfig(): Promise<MapsConfig> {
    const response = await apiClient.get<MapsConfig>("/maps/config");
    return response.data;
  },

  async forwardGeocode(query: string, options?: { country?: string; limit?: number }) {
    const response = await apiClient.get<{ data: GeocodeResult | null }>(
      "/maps/geocode/forward",
      {
        params: {
          q: query,
          country: options?.country,
          limit: options?.limit,
        },
      }
    );
    return response.data.data;
  },

  async reverseGeocode(longitude: number, latitude: number) {
    const response = await apiClient.get<{ data: GeocodeResult | null }>(
      "/maps/geocode/reverse",
      {
        params: { longitude, latitude },
      }
    );
    return response.data.data;
  },

  async searchSuggest(query: string, sessionToken: string) {
    const response = await apiClient.get("/maps/search/suggest", {
      params: { q: query, session_token: sessionToken },
    });
    return response.data;
  },

  async getDirections(params: {
    profile: "mapbox/driving" | "mapbox/walking" | "mapbox/cycling";
    coordinates: string;
  }) {
    const response = await apiClient.get("/maps/directions", { params });
    return response.data;
  },

  buildStaticImageUrl(params: {
    longitude: number;
    latitude: number;
    width: number;
    height: number;
    zoom?: number;
  }) {
    const search = new URLSearchParams({
      longitude: String(params.longitude),
      latitude: String(params.latitude),
      width: String(params.width),
      height: String(params.height),
      ...(params.zoom != null ? { zoom: String(params.zoom) } : {}),
    });
    return `${apiClient.defaults.baseURL}/maps/static-image?${search.toString()}`;
  },
};
