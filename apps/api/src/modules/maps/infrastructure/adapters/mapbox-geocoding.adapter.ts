import type { IMapboxClient } from "@atlasmed/mapbox";
import type { GeocodingPort } from "../../application/interfaces/geocoding.port";

export class MapboxGeocodingAdapter implements GeocodingPort {
  constructor(private readonly client: IMapboxClient) {}

  async forwardGeocode(input: {
    query: string;
    country?: string;
    proximity?: string;
    limit?: number;
  }) {
    const result = await this.client.forwardGeocode({
      query: input.query,
      country: input.country,
      proximity: input.proximity,
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

  async reverseGeocode(input: {
    latitude: number;
    longitude: number;
    limit?: number;
  }) {
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
