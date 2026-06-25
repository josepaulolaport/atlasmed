export type MapboxProfile =
  | "mapbox/driving"
  | "mapbox/driving-traffic"
  | "mapbox/walking"
  | "mapbox/cycling";

export type LngLat = [number, number];

export interface MapboxClientConfig {
  accessToken: string;
  username?: string;
  baseUrl?: string;
}

export interface MapboxRequestOptions {
  signal?: AbortSignal;
}
