import type { IMapboxClient } from "@atlasmed/mapbox";
import type {
  GeocodeHit,
  GeocodingPort,
} from "../../application/interfaces/geocoding.port";

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
    };
  }
}
