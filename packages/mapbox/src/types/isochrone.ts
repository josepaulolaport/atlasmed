import type { MultiPolygon, Polygon } from "geojson";
import type { MapboxProfile, MapboxRequestOptions } from "./common";

export interface IsochroneParams extends MapboxRequestOptions {
  profile: MapboxProfile;
  longitude: number;
  latitude: number;
  contoursMinutes?: number[];
  contoursMeters?: number[];
  polygons?: boolean;
  denoise?: number;
  generalize?: number;
}

export interface IsochroneResponse {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: Polygon | MultiPolygon;
    properties: {
      contour: number;
      metric: "time" | "distance";
    };
  }>;
}
