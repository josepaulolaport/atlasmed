import type { GeocodingPort } from "../../../maps/application/interfaces/geocoding.port";
import type { ClinicRepository } from "../interfaces/clinic.repository.interface";

export interface ResolvedCoordinates {
  lat: number | null;
  lng: number | null;
  geocoded: boolean;
}

export class ClinicGeocodingService {
  constructor(
    private readonly deps: {
      clinicRepository: ClinicRepository;
      geocodingPort?: GeocodingPort;
    }
  ) {}

  async resolveCoordinates(input: {
    address?: string | null;
    lat?: number | null;
    lng?: number | null;
  }): Promise<ResolvedCoordinates> {
    if (input.lat != null && input.lng != null) {
      return { lat: input.lat, lng: input.lng, geocoded: false };
    }

    if (input.lat != null || input.lng != null) {
      return {
        lat: input.lat ?? null,
        lng: input.lng ?? null,
        geocoded: false,
      };
    }

    const address = input.address?.trim();
    if (!address || !this.deps.geocodingPort) {
      return { lat: null, lng: null, geocoded: false };
    }

    const geocoded = await this.deps.geocodingPort.forwardGeocode({
      query: address,
      limit: 1,
    });

    if (!geocoded) {
      return { lat: null, lng: null, geocoded: false };
    }

    return {
      lat: geocoded.latitude,
      lng: geocoded.longitude,
      geocoded: true,
    };
  }

  /**
   * Geocodes from address when coordinates are missing and persists them so
   * Mapbox is not called again on subsequent reads or territory assignment.
   */
  async ensureCoordinatesPersisted(clinicId: string): Promise<ResolvedCoordinates | null> {
    const clinic = await this.deps.clinicRepository.findById(clinicId);
    if (!clinic) {
      return null;
    }

    if (clinic.lat != null && clinic.lng != null) {
      return { lat: clinic.lat, lng: clinic.lng, geocoded: false };
    }

    const resolved = await this.resolveCoordinates({
      address: clinic.address,
      lat: clinic.lat,
      lng: clinic.lng,
    });

    if (resolved.lat == null || resolved.lng == null) {
      return resolved;
    }

    if (resolved.geocoded) {
      await this.deps.clinicRepository.update(clinicId, {
        lat: resolved.lat,
        lng: resolved.lng,
      });
    }

    return resolved;
  }
}
