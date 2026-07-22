import type { GeocodingPort } from "../../../maps/application/interfaces/geocoding.port";
import type { FacilityRepository } from "../interfaces/facility.repository.interface";

export interface ResolvedCoordinates {
  lat: number | null;
  lng: number | null;
  geocoded: boolean;
}

/** Structured facility address used to build a Mapbox forward-geocode query. */
export interface AddressParts {
  streetAddress?: string | null;
  streetNumber?: string | null;
  addressComplement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
}

function trimPart(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Compose a Brazilian-oriented geocode query from structured parts.
 * Empty segments are omitted. Returns null when nothing usable remains.
 */
export function composeAddressQuery(parts: AddressParts): string | null {
  const streetAddress = trimPart(parts.streetAddress);
  const streetNumber = trimPart(parts.streetNumber);
  const addressComplement = trimPart(parts.addressComplement);
  const neighborhood = trimPart(parts.neighborhood);
  const city = trimPart(parts.city);
  const state = trimPart(parts.state);
  const postalCode = trimPart(parts.postalCode);
  const country = trimPart(parts.country) ?? "Brazil";

  const streetLine = [streetAddress, streetNumber].filter(Boolean).join(", ");
  const streetWithComplement = addressComplement
    ? [streetLine || null, addressComplement].filter(Boolean).join(" - ")
    : streetLine;

  const cityState = [city, state].filter(Boolean).join(" - ");

  const hasLocalSignal = Boolean(
    streetAddress || neighborhood || city || postalCode
  );
  if (!hasLocalSignal) {
    return null;
  }

  const segments = [
    streetWithComplement || null,
    neighborhood,
    cityState || null,
    postalCode,
    country,
  ].filter((segment): segment is string => Boolean(segment));

  return segments.join(", ");
}

export class FacilityGeocodingService {
  constructor(
    private readonly deps: {
      facilityRepository: FacilityRepository;
      geocodingPort?: GeocodingPort;
    }
  ) {}

  async geocodeAddress(
    parts: AddressParts
  ): Promise<{ lat: number; lng: number } | null> {
    const query = composeAddressQuery(parts);
    if (!query || !this.deps.geocodingPort) {
      return null;
    }

    const result = await this.deps.geocodingPort.forwardGeocode({
      query,
      country: "br",
      limit: 1,
    });

    if (!result) {
      return null;
    }

    return { lat: result.latitude, lng: result.longitude };
  }

  async resolveCoordinates(input: {
    lat?: number | null;
    lng?: number | null;
    address?: AddressParts | null;
  }): Promise<ResolvedCoordinates> {
    if (input.lat != null && input.lng != null) {
      return { lat: input.lat, lng: input.lng, geocoded: false };
    }

    if (input.address) {
      const geocoded = await this.geocodeAddress(input.address);
      if (geocoded) {
        return { lat: geocoded.lat, lng: geocoded.lng, geocoded: true };
      }
    }

    return {
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      geocoded: false,
    };
  }

  /**
   * Geocodes from address when coordinates are missing and persists them so
   * Mapbox is not called again on subsequent reads or territory assignment.
   */
  async ensureCoordinatesPersisted(facilityId: string): Promise<ResolvedCoordinates | null> {
    const clinic = await this.deps.facilityRepository.findById(facilityId);
    if (!clinic) {
      return null;
    }

    if (clinic.lat != null && clinic.lng != null) {
      return { lat: clinic.lat, lng: clinic.lng, geocoded: false };
    }

    const resolved = await this.resolveCoordinates({
      lat: clinic.lat,
      lng: clinic.lng,
      address: {
        streetAddress: clinic.streetAddress,
        streetNumber: clinic.streetNumber,
        addressComplement: clinic.addressComplement,
        neighborhood: clinic.neighborhood,
        city: clinic.city,
        state: clinic.state,
        postalCode: clinic.postalCode,
      },
    });

    if (resolved.lat == null || resolved.lng == null) {
      return resolved;
    }

    if (resolved.geocoded) {
      await this.deps.facilityRepository.update(facilityId, {
        lat: resolved.lat,
        lng: resolved.lng,
      });
    }

    return resolved;
  }
}
