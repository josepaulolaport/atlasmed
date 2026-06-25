import type { LngLat, MapboxProfile, MapboxRequestOptions } from "./common";

export interface MatrixParams extends MapboxRequestOptions {
  profile: MapboxProfile;
  coordinates: LngLat[];
  sources?: number[] | "all";
  destinations?: number[] | "all";
  annotations?: "duration" | "distance" | "duration,distance";
}

export interface MatrixResponse {
  code: string;
  durations?: number[][];
  distances?: number[][];
  sources: Array<{ location: LngLat; name: string }>;
  destinations: Array<{ location: LngLat; name: string }>;
}
