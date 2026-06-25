import type { Geometry } from "geojson";
import type { MapboxRequestOptions } from "./common";

export interface StaticImageParams extends MapboxRequestOptions {
  styleId?: string;
  username?: string;
  overlay?: string;
  longitude: number;
  latitude: number;
  zoom?: number;
  width: number;
  height: number;
  bearing?: number;
  pitch?: number;
  retina?: boolean;
}

export interface TilequeryParams extends MapboxRequestOptions {
  tilesetId: string;
  longitude: number;
  latitude: number;
  radius?: number;
  limit?: number;
  dedupe?: boolean;
  geometry?: "point" | "linestring" | "polygon";
  layers?: string;
}

export interface TilequeryResponse {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: Geometry;
    properties: Record<string, unknown>;
    id?: string | number;
  }>;
}
