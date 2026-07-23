import { beforeEach, describe, expect, it, mock } from "bun:test";
import {
  composeAddressQuery,
  FacilityGeocodingService,
} from "./facility-geocoding.service";
import type { FacilityRepository } from "../interfaces/facility.repository.interface";
import type { GeocodingPort } from "../../../maps/application/interfaces/geocoding.port";

function facilityStub(overrides: Record<string, unknown> = {}) {
  return {
    id: "clinic-1",
    name: "Clinic",
    neighborhood: "Jardim Paulista",
    city: "São Paulo",
    state: "SP",
    streetAddress: "Av. Paulista",
    streetNumber: "1000",
    addressComplement: null,
    postalCode: "01310-100",
    phone: null,
    whatsapp: null,
    email: null,
    website: null,
    responsibleName: null,
    openingHours: null,
    taxIdType: null,
    cnpj: null,
    cpf: null,
    lat: null,
    lng: null,
    territoryId: null,
    territoryName: null,
    territoryAssignmentStatus: "unassigned" as const,
    territoryAssignmentSource: "geo" as const,
    commercialStatus: null,
    purchaseStatus: null,
    conformityStatus: "INCOMPLETE" as const,
    consultantName: null,
    consultantSince: null,
    managerName: null,
    imageUrl: null,
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
    services: [],
    ...overrides,
  };
}

describe("composeAddressQuery", () => {
  it("builds a Brazilian address query omitting empty parts", () => {
    expect(
      composeAddressQuery({
        streetAddress: "Av. Paulista",
        streetNumber: "1000",
        addressComplement: "Cj 12",
        neighborhood: "Jardim Paulista",
        city: "São Paulo",
        state: "SP",
        postalCode: "01310-100",
      })
    ).toBe(
      "Av. Paulista, 1000 - Cj 12, Jardim Paulista, São Paulo - SP, 01310-100, Brazil"
    );
  });

  it("returns null when there is no local address signal", () => {
    expect(composeAddressQuery({ country: "Brazil" })).toBeNull();
    expect(composeAddressQuery({})).toBeNull();
  });
});

describe("FacilityGeocodingService", () => {
  const facilityRepository = {
    findById: mock(async () => facilityStub()),
    update: mock(async () =>
      facilityStub({ lat: -23.5505, lng: -46.6333 })
    ),
  } as unknown as FacilityRepository;

  const geocodingPort: GeocodingPort = {
    forwardGeocode: mock(async () => ({
      latitude: -23.5505,
      longitude: -46.6333,
      fullAddress: "Av. Paulista, São Paulo",
    })),
    reverseGeocode: mock(async () => null),
  };

  beforeEach(() => {
    (facilityRepository.findById as ReturnType<typeof mock>).mockClear();
    (facilityRepository.findById as ReturnType<typeof mock>).mockResolvedValue(
      facilityStub()
    );
    (facilityRepository.update as ReturnType<typeof mock>).mockClear();
    (geocodingPort.forwardGeocode as ReturnType<typeof mock>).mockClear();
    (geocodingPort.forwardGeocode as ReturnType<typeof mock>).mockResolvedValue({
      latitude: -23.5505,
      longitude: -46.6333,
      fullAddress: "Av. Paulista, São Paulo",
    });
  });

  it("returns provided coordinates without calling Mapbox", async () => {
    const service = new FacilityGeocodingService({
      facilityRepository,
      geocodingPort,
    });

    const result = await service.resolveCoordinates({
      lat: -23.5,
      lng: -46.6,
      address: { streetAddress: "Av. Paulista", city: "São Paulo" },
    });

    expect(result).toEqual({ lat: -23.5, lng: -46.6, geocoded: false });
    expect(geocodingPort.forwardGeocode).not.toHaveBeenCalled();
  });

  it("geocodes from address when coordinates are missing", async () => {
    const service = new FacilityGeocodingService({
      facilityRepository,
      geocodingPort,
    });

    const result = await service.resolveCoordinates({
      address: {
        streetAddress: "Av. Paulista",
        streetNumber: "1000",
        city: "São Paulo",
        state: "SP",
      },
    });

    expect(result).toEqual({
      lat: -23.5505,
      lng: -46.6333,
      geocoded: true,
    });
    expect(geocodingPort.forwardGeocode).toHaveBeenCalledWith({
      query: "Av. Paulista, 1000, São Paulo - SP, Brazil",
      country: "br",
      limit: 1,
    });
  });

  it("returns null coordinates when geocode yields no result", async () => {
    (geocodingPort.forwardGeocode as ReturnType<typeof mock>).mockResolvedValueOnce(
      null
    );

    const service = new FacilityGeocodingService({
      facilityRepository,
      geocodingPort,
    });

    const result = await service.resolveCoordinates({
      address: { streetAddress: "Rua Inexistente", city: "São Paulo" },
    });

    expect(result).toEqual({ lat: null, lng: null, geocoded: false });
  });

  it("persists geocoded coordinates when facility has address but no point", async () => {
    const service = new FacilityGeocodingService({
      facilityRepository,
      geocodingPort,
    });

    const result = await service.ensureCoordinatesPersisted("clinic-1");

    expect(result).toEqual({
      lat: -23.5505,
      lng: -46.6333,
      geocoded: true,
    });
    expect(facilityRepository.update).toHaveBeenCalledWith("clinic-1", {
      lat: -23.5505,
      lng: -46.6333,
    });
  });

  it("does not geocode again when coordinates already exist", async () => {
    (facilityRepository.findById as ReturnType<typeof mock>).mockResolvedValueOnce(
      facilityStub({ lat: -23.5505, lng: -46.6333 })
    );

    const service = new FacilityGeocodingService({
      facilityRepository,
      geocodingPort,
    });
    const result = await service.ensureCoordinatesPersisted("clinic-1");

    expect(result).toEqual({
      lat: -23.5505,
      lng: -46.6333,
      geocoded: false,
    });
    expect(geocodingPort.forwardGeocode).not.toHaveBeenCalled();
    expect(facilityRepository.update).not.toHaveBeenCalled();
  });

  it("skips geocode when facility has no usable address parts", async () => {
    (facilityRepository.findById as ReturnType<typeof mock>).mockResolvedValueOnce(
      facilityStub({
        streetAddress: null,
        streetNumber: null,
        addressComplement: null,
        neighborhood: null,
        city: null,
        state: null,
        postalCode: null,
      })
    );

    const service = new FacilityGeocodingService({
      facilityRepository,
      geocodingPort,
    });

    const result = await service.ensureCoordinatesPersisted("clinic-1");

    expect(result).toEqual({ lat: null, lng: null, geocoded: false });
    expect(geocodingPort.forwardGeocode).not.toHaveBeenCalled();
    expect(facilityRepository.update).not.toHaveBeenCalled();
  });
});
