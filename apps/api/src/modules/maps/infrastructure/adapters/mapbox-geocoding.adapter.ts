import type { GeocodeFeature, IMapboxClient } from "@atlasmed/mapbox";
import type {
  GeocodeAddressParts,
  GeocodeHit,
  GeocodingPort,
} from "../../application/interfaces/geocoding.port";

/**
 * Geocoding v6 hangs the address layers off `properties.context`, from the
 * building outwards. Reading them is what lets a dropped pin fill a form rather
 * than hand back one formatted string for somebody to split apart again.
 */
function toAddressParts(feature: GeocodeFeature): GeocodeAddressParts {
  const context = feature.properties.context ?? {};
  const address = context.address;

  return {
    // `street_name` is the street without the number; `street.name` is the
    // fallback when the pin landed on a road rather than on a building.
    streetAddress: address?.street_name ?? context.street?.name,
    streetNumber: address?.address_number,
    neighborhood: context.neighborhood?.name,
    postalCode: context.postcode?.name,
    city: context.place?.name,
    state: context.region?.region_code ?? context.region?.name,
  };
}

export class MapboxGeocodingAdapter implements GeocodingPort {
  constructor(private readonly client: IMapboxClient) {}

  async forwardGeocode(input: {
    query: string;
    country?: string;
    proximity?: string;
    limit?: number;
  }): Promise<GeocodeHit | null> {
    const many = await this.forwardGeocodeMany({
      ...input,
      limit: input.limit ?? 1,
    });
    return many[0] ?? null;
  }

  async forwardGeocodeMany(input: {
    query: string;
    country?: string;
    proximity?: string;
    limit?: number;
  }): Promise<GeocodeHit[]> {
    const response = await this.client.geocodeForwardRaw({
      query: input.query,
      country: input.country,
      proximity: input.proximity,
      language: "pt",
      limit: input.limit ?? 5,
    });

    return response.features.map((feature) => {
      const [longitude, latitude] = feature.geometry.coordinates;
      return {
        latitude,
        longitude,
        fullAddress:
          feature.properties.full_address ?? feature.properties.place_formatted,
        name: feature.properties.name,
        parts: toAddressParts(feature),
      };
    });
  }

  async reverseGeocode(input: {
    latitude: number;
    longitude: number;
    limit?: number;
  }): Promise<GeocodeHit | null> {
    const result = await this.client.reverseGeocode({
      latitude: input.latitude,
      longitude: input.longitude,
      limit: input.limit ?? 1,
    });

    if (!result) {
      return null;
    }

    return {
      latitude: result.latitude,
      longitude: result.longitude,
      fullAddress: result.fullAddress,
      name: result.name,
      parts: toAddressParts(result.raw),
    };
  }
}
