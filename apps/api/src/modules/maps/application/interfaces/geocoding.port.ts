/**
 * The address a hit sits at, broken into the fields a form has.
 *
 * Dropping a pin has to fill logradouro, número, bairro and CEP separately, and
 * splitting `fullAddress` back apart is guesswork — Mapbox already ships the
 * pieces.
 */
export type GeocodeAddressParts = {
  streetAddress?: string;
  streetNumber?: string;
  neighborhood?: string;
  postalCode?: string;
  city?: string;
  state?: string;
};

export type GeocodeHit = {
  latitude: number;
  longitude: number;
  fullAddress?: string;
  name?: string;
  parts?: GeocodeAddressParts;
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
