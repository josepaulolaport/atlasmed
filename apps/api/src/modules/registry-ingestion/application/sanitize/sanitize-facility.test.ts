import { describe, expect, it } from "bun:test";
import { sanitizeFacilityRecord, sanitizeFacilityBatch } from "./sanitize-facility";
import { computeContentHash } from "./content-hash";

describe("sanitize-facility", () => {
  it("normalizes clinic text fields", () => {
    const result = sanitizeFacilityRecord({
      externalSourceId: "mock-clinic-001",
      name: "  Alpha   Medical  ",
      address: " 100 Main St ",
      lat: -23.55,
      lng: -46.63,
    });

    expect(result).toEqual({
      externalSourceId: "mock-clinic-001",
      name: "Alpha Medical",
      address: "100 Main St",
      lat: -23.55,
      lng: -46.63,
      contentHash: computeContentHash({
        externalSourceId: "mock-clinic-001",
        name: "Alpha Medical",
        address: "100 Main St",
        lat: -23.55,
        lng: -46.63,
      }),
    });
  });

  it("rejects invalid clinic records", () => {
    expect(sanitizeFacilityRecord({ externalSourceId: "", name: "X" })).toBeNull();
  });

  it("counts invalid records in batch", () => {
    const batch = sanitizeFacilityBatch([
      { externalSourceId: "a", name: "Valid" },
      { externalSourceId: "", name: "Invalid" },
    ]);

    expect(batch.valid).toHaveLength(1);
    expect(batch.invalidCount).toBe(1);
  });
});
