import type { LineString } from "geojson";
import type { LngLat, MapboxProfile, MapboxRequestOptions } from "./common";

export interface MapMatchingParams extends MapboxRequestOptions {
  profile: MapboxProfile;
  coordinates: LngLat[];
  geometries?: "geojson" | "polyline" | "polyline6";
  steps?: boolean;
  tidy?: boolean;
  timestamps?: number[];
  radiuses?: number[];
}

export interface MapMatchingResponse {
  code: string;
  matchings: Array<{
    confidence: number;
    geometry: LineString | string;
    duration: number;
    distance: number;
    legs: unknown[];
  }>;
  tracepoints: unknown[];
}
