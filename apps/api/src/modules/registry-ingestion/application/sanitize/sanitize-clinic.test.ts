import { describe, expect, it } from "bun:test";
import { sanitizeClinicRecord, sanitizeClinicBatch } from "./sanitize-clinic";
import { computeContentHash } from "./content-hash";

describe("sanitize-clinic", () => {
  it("normalizes clinic text fields", () => {
    const result = sanitizeClinicRecord({
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
    expect(sanitizeClinicRecord({ externalSourceId: "", name: "X" })).toBeNull();
  });

  it("counts invalid records in batch", () => {
    const batch = sanitizeClinicBatch([
      { externalSourceId: "a", name: "Valid" },
      { externalSourceId: "", name: "Invalid" },
    ]);

    expect(batch.valid).toHaveLength(1);
    expect(batch.invalidCount).toBe(1);
  });
});
