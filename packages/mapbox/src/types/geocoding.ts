import type { MapboxRequestOptions } from "./common";

export interface ForwardGeocodeParams extends MapboxRequestOptions {
  query: string;
  country?: string;
  language?: string;
  limit?: number;
  proximity?: string;
  bbox?: string;
  types?: string;
  autocomplete?: boolean;
}

export interface ReverseGeocodeParams extends MapboxRequestOptions {
  longitude: number;
  latitude: number;
  language?: string;
  limit?: number;
  types?: string;
}

export interface GeocodeFeatureProperties {
  name?: string;
  full_address?: string;
  place_formatted?: string;
  mapbox_id?: string;
  feature_type?: string;
  coordinates?: {
    longitude: number;
    latitude: number;
    accuracy?: string;
  };
}

export interface GeocodeFeature {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
  properties: GeocodeFeatureProperties;
}

export interface GeocodeResponse {
  type: "FeatureCollection";
  features: GeocodeFeature[];
  attribution?: string;
}

export interface GeocodeResult {
  longitude: number;
  latitude: number;
  fullAddress?: string;
  name?: string;
  mapboxId?: string;
  raw: GeocodeFeature;
}
