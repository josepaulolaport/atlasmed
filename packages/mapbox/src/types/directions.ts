import type { LineString } from "geojson";
import type { LngLat, MapboxProfile, MapboxRequestOptions } from "./common";

export interface DirectionsParams extends MapboxRequestOptions {
  profile: MapboxProfile;
  coordinates: LngLat[];
  alternatives?: boolean;
  geometries?: "geojson" | "polyline" | "polyline6";
  overview?: "full" | "simplified" | "false";
  steps?: boolean;
  annotations?: string;
  language?: string;
}

export interface DirectionsRoute {
  geometry: LineString | string;
  duration: number;
  distance: number;
  weight: number;
  weight_name: string;
  legs: unknown[];
}

export interface DirectionsResponse {
  code: string;
  routes: DirectionsRoute[];
  waypoints: Array<{
    name: string;
    location: LngLat;
  }>;
  uuid?: string;
}
