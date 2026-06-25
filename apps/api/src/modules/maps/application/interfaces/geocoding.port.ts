export interface GeocodingPort {
  forwardGeocode(input: {
    query: string;
    country?: string;
    proximity?: string;
    limit?: number;
  }): Promise<{
    latitude: number;
    longitude: number;
    fullAddress?: string;
    name?: string;
  } | null>;

  reverseGeocode(input: {
    latitude: number;
    longitude: number;
    limit?: number;
  }): Promise<{
    latitude: number;
    longitude: number;
    fullAddress?: string;
    name?: string;
  } | null>;
}
