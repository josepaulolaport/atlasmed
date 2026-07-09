import { describe, expect, test } from "bun:test";
import { buildFacilityAddress, computeContentHash } from "../reconcile/content-hash";

describe("content hash", () => {
  test("builds stable facility hash payload", () => {
    const address = buildFacilityAddress({
      streetAddress: "Rua A",
      streetNumber: "10",
      neighborhood: "Centro",
      postalCode: "01000-000",
    });

    const hash = computeContentHash({
      name: "Clinic A",
      address,
      lat: -23.5,
      lng: -46.6,
      referenceMunicipalityCode: "3550308",
    });

    expect(address).toBe("Rua A, 10, Centro, 01000-000");
    expect(hash).toHaveLength(64);
  });
});
