import { describe, expect, it } from "bun:test";
import { computeContentHash } from "./content-hash";
import { sanitizeDoctorBatch, sanitizeDoctorRecord } from "./sanitize-doctor";

describe("sanitize-doctor", () => {
  it("normalizes doctor text fields", () => {
    const result = sanitizeDoctorRecord({
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
    expect(sanitizeDoctorRecord({ externalSourceId: "", firstName: "X", lastName: "Y" })).toBeNull();
  });

  it("counts invalid records in batch", () => {
    const batch = sanitizeDoctorBatch([
      { externalSourceId: "a", firstName: "Valid", lastName: "Doctor" },
      { externalSourceId: "", firstName: "Invalid", lastName: "Doctor" },
    ]);

    expect(batch.valid).toHaveLength(1);
    expect(batch.invalidCount).toBe(1);
  });
});
