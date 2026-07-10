import { beforeEach, describe, expect, it, mock } from "bun:test";
import { FacilityGeocodingService } from "./facility-geocoding.service";
import type { FacilityRepository } from "../interfaces/facility.repository.interface";
import type { GeocodingPort } from "../../../maps/application/interfaces/geocoding.port";

describe("FacilityGeocodingService", () => {
  const facilityRepository = {
    findById: mock(async () => ({
      id: "clinic-1",
      name: "Clinic",
      address: "São Paulo, Brazil",
      lat: null,
      lng: null,
      territoryId: null,
      territoryAssignmentStatus: "unassigned" as const,
      territoryAssignmentSource: "geo" as const,
      sourceProvider: null,
      externalSourceId: null,
      sourceContentHash: null,
      sourceFirstSeenAt: null,
      sourceLastSeenAt: null,
      sourcePresent: false,
      sourceTracked: false,
      manuallyEditedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deactivatedAt: null,
    })),
    update: mock(async () => ({
      id: "clinic-1",
      name: "Clinic",
      address: "São Paulo, Brazil",
      lat: -23.5505,
      lng: -46.6333,
      territoryId: null,
      territoryAssignmentStatus: "unassigned" as const,
      territoryAssignmentSource: "geo" as const,
      sourceProvider: null,
      externalSourceId: null,
      sourceContentHash: null,
      sourceFirstSeenAt: null,
      sourceLastSeenAt: null,
      sourcePresent: false,
      sourceTracked: false,
      manuallyEditedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deactivatedAt: null,
    })),
  } as unknown as FacilityRepository;

  const geocodingPort: GeocodingPort = {
    forwardGeocode: mock(async () => ({
      latitude: -23.5505,
      longitude: -46.6333,
      fullAddress: "São Paulo, Brazil",
    })),
    reverseGeocode: mock(async () => null),
  };

  beforeEach(() => {
    (facilityRepository.findById as ReturnType<typeof mock>).mockClear();
    (facilityRepository.update as ReturnType<typeof mock>).mockClear();
    (geocodingPort.forwardGeocode as ReturnType<typeof mock>).mockClear();
  });

  it("returns null coordinates without geocoding when lat/lng are missing", async () => {
    const service = new FacilityGeocodingService({ facilityRepository, geocodingPort });

    const result = await service.ensureCoordinatesPersisted("clinic-1");

    expect(result).toEqual({
      lat: null,
      lng: null,
      geocoded: false,
    });
    expect(facilityRepository.update).not.toHaveBeenCalled();
    expect(geocodingPort.forwardGeocode).not.toHaveBeenCalled();
  });

  it("does not geocode again when coordinates already exist", async () => {
    (facilityRepository.findById as ReturnType<typeof mock>).mockResolvedValueOnce({
      id: "clinic-1",
      address: "São Paulo, Brazil",
      lat: -23.5505,
      lng: -46.6333,
    });

    const service = new FacilityGeocodingService({ facilityRepository, geocodingPort });
    const result = await service.ensureCoordinatesPersisted("clinic-1");

    expect(result).toEqual({
      lat: -23.5505,
      lng: -46.6333,
      geocoded: false,
    });
    expect(geocodingPort.forwardGeocode).not.toHaveBeenCalled();
    expect(facilityRepository.update).not.toHaveBeenCalled();
  });
});
