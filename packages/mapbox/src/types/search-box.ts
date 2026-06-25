import type { MapboxRequestOptions } from "./common";

export interface SearchBoxSuggestParams extends MapboxRequestOptions {
  query: string;
  sessionToken: string;
  language?: string;
  limit?: number;
  country?: string;
  proximity?: string;
  types?: string;
}

export interface SearchBoxRetrieveParams extends MapboxRequestOptions {
  mapboxId: string;
  sessionToken: string;
}

export interface SearchBoxSuggestion {
  name: string;
  mapbox_id: string;
  feature_type?: string;
  place_formatted?: string;
  full_address?: string;
}

export interface SearchBoxSuggestResponse {
  suggestions: SearchBoxSuggestion[];
  attribution?: string;
}

export interface SearchBoxRetrieveResponse {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: { type: "Point"; coordinates: [number, number] };
    properties: Record<string, unknown>;
  }>;
}
