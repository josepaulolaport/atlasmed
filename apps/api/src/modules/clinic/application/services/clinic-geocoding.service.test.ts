import { beforeEach, describe, expect, it, mock } from "bun:test";
import { ClinicGeocodingService } from "./clinic-geocoding.service";
import type { ClinicRepository } from "../interfaces/clinic.repository.interface";
import type { GeocodingPort } from "../../../maps/application/interfaces/geocoding.port";

describe("ClinicGeocodingService", () => {
  const clinicRepository = {
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
      deletedAt: null,
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
      deletedAt: null,
    })),
  } as unknown as ClinicRepository;

  const geocodingPort: GeocodingPort = {
    forwardGeocode: mock(async () => ({
      latitude: -23.5505,
      longitude: -46.6333,
      fullAddress: "São Paulo, Brazil",
    })),
    reverseGeocode: mock(async () => null),
  };

  beforeEach(() => {
    (clinicRepository.findById as ReturnType<typeof mock>).mockClear();
    (clinicRepository.update as ReturnType<typeof mock>).mockClear();
    (geocodingPort.forwardGeocode as ReturnType<typeof mock>).mockClear();
  });

  it("persists geocoded coordinates for clinics missing lat/lng", async () => {
    const service = new ClinicGeocodingService({ clinicRepository, geocodingPort });

    const result = await service.ensureCoordinatesPersisted("clinic-1");

    expect(result).toEqual({
      lat: -23.5505,
      lng: -46.6333,
      geocoded: true,
    });
    expect(clinicRepository.update).toHaveBeenCalledWith("clinic-1", {
      lat: -23.5505,
      lng: -46.6333,
    });
    expect(geocodingPort.forwardGeocode).toHaveBeenCalledTimes(1);
  });

  it("does not geocode again when coordinates already exist", async () => {
    (clinicRepository.findById as ReturnType<typeof mock>).mockResolvedValueOnce({
      id: "clinic-1",
      address: "São Paulo, Brazil",
      lat: -23.5505,
      lng: -46.6333,
    });

    const service = new ClinicGeocodingService({ clinicRepository, geocodingPort });
    const result = await service.ensureCoordinatesPersisted("clinic-1");

    expect(result).toEqual({
      lat: -23.5505,
      lng: -46.6333,
      geocoded: false,
    });
    expect(geocodingPort.forwardGeocode).not.toHaveBeenCalled();
    expect(clinicRepository.update).not.toHaveBeenCalled();
  });
});
