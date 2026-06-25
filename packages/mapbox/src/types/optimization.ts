import type { LineString } from "geojson";
import type { LngLat, MapboxProfile, MapboxRequestOptions } from "./common";

export interface OptimizationParams extends MapboxRequestOptions {
  profile: MapboxProfile;
  coordinates: LngLat[];
  source?: "first" | "any";
  destination?: "last" | "any";
  roundtrip?: boolean;
  geometries?: "geojson" | "polyline" | "polyline6";
  steps?: boolean;
}

export interface OptimizationResponse {
  code: string;
  trips: Array<{
    geometry: LineString | string;
    duration: number;
    distance: number;
    weight: number;
    legs: unknown[];
  }>;
  waypoints: Array<{
    waypoint_index: number;
    trips_index: number;
    location: LngLat;
    name: string;
  }>;
}
