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

/** One layer of Geocoding v6's `properties.context`. */
export interface GeocodeContextEntry {
  mapbox_id?: string;
  name?: string;
  /** Present on `address`: the house number, apart from the street name. */
  address_number?: string;
  /** Present on `address`: the street, apart from the number. */
  street_name?: string;
  /** Present on `region`: "SP", "RJ". */
  region_code?: string;
}

/**
 * The layers Geocoding v6 hangs off a feature, from the building outwards.
 *
 * Reverse geocoding needs these rather than `full_address`: dropping a pin has
 * to fill logradouro, número, bairro and CEP as separate fields, and splitting
 * one formatted string back apart is guesswork.
 */
export interface GeocodeContext {
  address?: GeocodeContextEntry;
  street?: GeocodeContextEntry;
  neighborhood?: GeocodeContextEntry;
  postcode?: GeocodeContextEntry;
  place?: GeocodeContextEntry;
  region?: GeocodeContextEntry;
  country?: GeocodeContextEntry;
}

export interface GeocodeFeatureProperties {
  name?: string;
  full_address?: string;
  place_formatted?: string;
  mapbox_id?: string;
  feature_type?: string;
  context?: GeocodeContext;
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
