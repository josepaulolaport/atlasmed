import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import {
  composeAddressQuery,
  FacilityGeocodingService,
  pickBestGeocodeCandidate,
} from "./facility-geocoding.service";
import type { FacilityRepository } from "../interfaces/facility.repository.interface";
import type { GeocodingPort } from "../../../maps/application/interfaces/geocoding.port";

function facilityStub(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: "Clinic",
    neighborhood: "Jardim Paulista",
    city: "São Paulo",
    state: "SP",
    streetAddress: "Av. Paulista",
    streetNumber: "1000",
    addressComplement: null,
    postalCode: "01310-100",
    stateId: 1,
    municipalityId: 1,
    phone: null,
    whatsapp: null,
    email: null,
    website: null,
    responsibleName: null,
    openingHours: null,
    legalDocumentType: "CNPJ",
    legalDocument: null,
    lat: null,
    lng: null,
    territoryId: null,
    territoryName: null,
    territoryAssignmentStatus: "unassigned" as const,
    commercialStatus: null,
    purchaseStatus: null,
    conformityStatus: "INCOMPLETE" as const,
    consultantName: null,
    consultantSince: null,
    managerName: null,
    imageUrl: null,
    cnesCode: null,
    unitTypeId: null,
    unitSubtypeId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deactivatedAt: null,
    clinicalFocuses: [],
    ...overrides,
  };
}

describe("composeAddressQuery", () => {
  it("builds a Brazilian address query omitting empty parts", () => {
    expect(
      composeAddressQuery({
        streetAddress: "Av. Paulista",
        streetNumber: "1000",
        neighborhood: "Jardim Paulista",
        city: "São Paulo",
        state: "SP",
        postalCode: "01310100",
      })
    ).toBe(
      "Avenida Paulista, 1000, Jardim Paulista, São Paulo - SP, 01310-100, Brazil"
    );
  });

  it("can omit country for Mapbox country=br calls", () => {
    expect(
      composeAddressQuery(
        {
          streetAddress: "R GAL MONTEIRO",
          streetNumber: "76",
          neighborhood: "BOTAFOGO",
          city: "RIO DE JANEIRO",
          state: "RJ",
          postalCode: "22290080",
        },
        { includeCountry: false }
      )
    ).toBe(
      "Rua General MONTEIRO, 76, BOTAFOGO, RIO DE JANEIRO - RJ, 22290-080"
    );
  });

  it("returns null when there is no local address signal", () => {
    expect(composeAddressQuery({ country: "Brazil" })).toBeNull();
    expect(composeAddressQuery({})).toBeNull();
  });
});

describe("pickBestGeocodeCandidate", () => {
  it("prefers Botafogo / Rio over a Resende street match", () => {
    const best = pickBestGeocodeCandidate(
      [
        {
          latitude: -22.45519,
          longitude: -44.45592,
          fullAddress:
            "Rua General Monteiro de Barros 76, Resende - Rio de Janeiro, 27533, Brasil",
        },
        {
          latitude: -22.956,
          longitude: -43.17959,
          fullAddress:
            "Rua General Góis Monteiro 76, Botafogo, Rio de Janeiro - Rio de Janeiro, 22290-080, Brasil",
        },
      ],
      {
        city: "RIO DE JANEIRO",
        state: "RJ",
        neighborhood: "BOTAFOGO",
        postalCode: "22290080",
      }
    );

    expect(best?.latitude).toBeCloseTo(-22.956, 4);
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
    forwardGeocodeMany: mock(async () => [
      {
        latitude: -23.5505,
        longitude: -46.6333,
        fullAddress: "Av. Paulista, São Paulo, São Paulo, Brasil",
      },
    ]),
    reverseGeocode: mock(async () => null),
  };

  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = mock(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("viacep.com.br/ws/01310100")) {
        return new Response(
          JSON.stringify({
            cep: "01310-100",
            logradouro: "Avenida Paulista",
            bairro: "Bela Vista",
            localidade: "São Paulo",
            uf: "SP",
          })
        );
      }
      return new Response(JSON.stringify({ erro: true }), { status: 200 });
    }) as unknown as typeof fetch;

    (geocodingPort.forwardGeocodeMany as ReturnType<typeof mock>).mockClear();
    (geocodingPort.forwardGeocodeMany as ReturnType<typeof mock>).mockResolvedValue([
      {
        latitude: -23.5505,
        longitude: -46.6333,
        fullAddress: "Av. Paulista, São Paulo, São Paulo, Brasil",
      },
    ]);
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

  afterEach(() => {
    globalThis.fetch = originalFetch;
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
    expect(geocodingPort.forwardGeocodeMany).toHaveBeenCalledWith({
      query: "Avenida Paulista, 1000, São Paulo - SP",
      country: "br",
      limit: 5,
    });
  });

  it("returns null coordinates when geocode yields no result", async () => {
    (geocodingPort.forwardGeocodeMany as ReturnType<typeof mock>).mockResolvedValueOnce(
      []
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

    const result = await service.ensureCoordinatesPersisted(1);

    expect(result).toEqual({
      lat: -23.5505,
      lng: -46.6333,
      geocoded: true,
    });
    expect(geocodingPort.forwardGeocodeMany).toHaveBeenCalledWith({
      query:
        "Avenida Paulista, 1000, Bela Vista, São Paulo - SP, 01310-100",
      country: "br",
      limit: 5,
    });
    expect(facilityRepository.update).toHaveBeenCalledWith(1, {
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
    const result = await service.ensureCoordinatesPersisted(1);

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

    const result = await service.ensureCoordinatesPersisted(1);

    expect(result).toEqual({ lat: null, lng: null, geocoded: false });
    expect(geocodingPort.forwardGeocode).not.toHaveBeenCalled();
    expect(facilityRepository.update).not.toHaveBeenCalled();
  });
});
