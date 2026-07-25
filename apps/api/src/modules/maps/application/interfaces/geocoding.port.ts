export type GeocodeHit = {
  latitude: number;
  longitude: number;
  fullAddress?: string;
  name?: string;
};

export interface GeocodingPort {
  forwardGeocode(input: {
    query: string;
    country?: string;
    proximity?: string;
    limit?: number;
  }): Promise<GeocodeHit | null>;

  /** Optional: return ranked candidates (Mapbox adapter implements this). */
  forwardGeocodeMany?(input: {
    query: string;
    country?: string;
    proximity?: string;
    limit?: number;
  }): Promise<GeocodeHit[]>;

  reverseGeocode(input: {
    latitude: number;
    longitude: number;
    limit?: number;
  }): Promise<GeocodeHit | null>;
}
