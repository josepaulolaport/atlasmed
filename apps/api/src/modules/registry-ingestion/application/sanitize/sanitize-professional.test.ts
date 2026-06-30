import { describe, expect, it } from "bun:test";
import { computeContentHash } from "./content-hash";
import { sanitizeProfessionalBatch, sanitizeProfessionalRecord } from "./sanitize-professional";

describe("sanitize-professional", () => {
  it("normalizes doctor text fields", () => {
    const result = sanitizeProfessionalRecord({
      externalSourceId: "mock-doctor-001",
      firstName: "  Jane  ",
      lastName: "  Smith ",
      specialty: "  Cardiology ",
    });

    expect(result).toEqual({
      externalSourceId: "mock-doctor-001",
      firstName: "Jane",
      lastName: "Smith",
      specialty: "Cardiology",
      contentHash: computeContentHash({
        externalSourceId: "mock-doctor-001",
        firstName: "Jane",
        lastName: "Smith",
        specialty: "Cardiology",
      }),
    });
  });

  it("rejects invalid doctor records", () => {
    expect(sanitizeProfessionalRecord({ externalSourceId: "", firstName: "X", lastName: "Y" })).toBeNull();
  });

  it("counts invalid records in batch", () => {
    const batch = sanitizeProfessionalBatch([
      { externalSourceId: "a", firstName: "Valid", lastName: "Doctor" },
      { externalSourceId: "", firstName: "Invalid", lastName: "Doctor" },
    ]);

    expect(batch.valid).toHaveLength(1);
    expect(batch.invalidCount).toBe(1);
  });
});
