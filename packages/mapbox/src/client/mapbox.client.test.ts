import { describe, expect, it, mock } from "bun:test";
import { MapboxClient } from "./mapbox.client";
import { MapboxError } from "../errors";

describe("MapboxClient", () => {
  it("parses forward geocode results", async () => {
    const fetchMock = mock(async () =>
      new Response(
        JSON.stringify({
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: { type: "Point", coordinates: [-46.6333, -23.5505] },
              properties: {
                name: "São Paulo",
                full_address: "São Paulo, Brazil",
                mapbox_id: "place.123",
              },
            },
          ],
        }),
        { status: 200 }
      )
    );

    globalThis.fetch = fetchMock as typeof fetch;

    const client = new MapboxClient({ accessToken: "sk.test" });
    const result = await client.forwardGeocode({ query: "São Paulo" });

    expect(result).toEqual({
      longitude: -46.6333,
      latitude: -23.5505,
      fullAddress: "São Paulo, Brazil",
      name: "São Paulo",
      mapboxId: "place.123",
      raw: expect.any(Object),
    });
  });

  it("throws MapboxError on failed requests", async () => {
    globalThis.fetch = mock(async () =>
      new Response(JSON.stringify({ message: "Not Authorized" }), { status: 401 })
    ) as typeof fetch;

    const client = new MapboxClient({ accessToken: "sk.invalid" });

    await expect(client.forwardGeocode({ query: "test" })).rejects.toBeInstanceOf(
      MapboxError
    );
  });

  it("builds static image URLs with access token", () => {
    const client = new MapboxClient({ accessToken: "sk.test", username: "jlaport" });
    const url = client.buildStaticImageUrl({
      longitude: -46.6333,
      latitude: -23.5505,
      width: 600,
      height: 400,
    });

    expect(url).toContain("/styles/v1/jlaport/streets-v12/static/");
    expect(url).toContain("access_token=sk.test");
  });
});
