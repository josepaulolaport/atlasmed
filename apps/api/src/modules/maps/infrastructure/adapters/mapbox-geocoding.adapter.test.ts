import { describe, expect, it, mock } from "bun:test";
import type { GeocodeFeature, IMapboxClient } from "@atlasmed/mapbox";
import { MapboxGeocodingAdapter } from "./mapbox-geocoding.adapter";

function feature(context: Record<string, unknown>): GeocodeFeature {
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: [-46.6563, -23.5613] },
    properties: {
      full_address: "Avenida Paulista, 1578 - Bela Vista, São Paulo - SP",
      context,
    },
  } as GeocodeFeature;
}

const paulista = {
  address: { address_number: "1578", street_name: "Avenida Paulista" },
  street: { name: "Avenida Paulista" },
  neighborhood: { name: "Bela Vista" },
  postcode: { name: "01310-200" },
  place: { name: "São Paulo" },
  region: { name: "São Paulo", region_code: "SP" },
};

function clientReturning(f: GeocodeFeature): IMapboxClient {
  return {
    geocodeForwardRaw: mock(async () => ({
      type: "FeatureCollection" as const,
      features: [f],
    })),
    reverseGeocode: mock(async () => ({
      latitude: f.geometry.coordinates[1],
      longitude: f.geometry.coordinates[0],
      fullAddress: f.properties.full_address,
      name: f.properties.name,
      raw: f,
    })),
  } as unknown as IMapboxClient;
}

describe("MapboxGeocodingAdapter address parts", () => {
  it("reads the street and the number as separate fields", async () => {
    const adapter = new MapboxGeocodingAdapter(
      clientReturning(feature(paulista))
    );

    const hit = await adapter.reverseGeocode({
      latitude: -23.5613,
      longitude: -46.6563,
    });

    // Splitting `full_address` back apart is the guesswork this avoids.
    expect(hit?.parts?.streetAddress).toBe("Avenida Paulista");
    expect(hit?.parts?.streetNumber).toBe("1578");
    expect(hit?.parts?.neighborhood).toBe("Bela Vista");
    expect(hit?.parts?.postalCode).toBe("01310-200");
    expect(hit?.parts?.city).toBe("São Paulo");
  });

  it("prefers the two-letter state over the state's full name", async () => {
    const adapter = new MapboxGeocodingAdapter(
      clientReturning(feature(paulista))
    );

    const hit = await adapter.reverseGeocode({
      latitude: -23.5613,
      longitude: -46.6563,
    });

    expect(hit?.parts?.state).toBe("SP");
  });

  it("falls back to the road when the pin did not land on a building", async () => {
    const adapter = new MapboxGeocodingAdapter(
      clientReturning(
        feature({ street: { name: "Rua Sem Número" }, place: { name: "Santos" } })
      )
    );

    const hit = await adapter.reverseGeocode({
      latitude: -23.9,
      longitude: -46.3,
    });

    expect(hit?.parts?.streetAddress).toBe("Rua Sem Número");
    expect(hit?.parts?.streetNumber).toBeUndefined();
  });

  it("carries the parts on forward results too", async () => {
    const adapter = new MapboxGeocodingAdapter(
      clientReturning(feature(paulista))
    );

    const hits = await adapter.forwardGeocodeMany({ query: "Av Paulista 1578" });

    expect(hits[0]?.parts?.streetNumber).toBe("1578");
  });

  it("survives a feature with no context at all", async () => {
    const adapter = new MapboxGeocodingAdapter(clientReturning(feature({})));

    const hit = await adapter.reverseGeocode({ latitude: 0, longitude: 0 });

    expect(hit?.parts).toEqual({
      streetAddress: undefined,
      streetNumber: undefined,
      neighborhood: undefined,
      postalCode: undefined,
      city: undefined,
      state: undefined,
    });
  });
});
