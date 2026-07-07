import { describe, expect, it } from "bun:test";
import {
  buildProfessionalSourceUpsertFromRegistry,
  projectRegistryProfessional,
} from "./registry-projection.service";

describe("registry professional projection", () => {
  it("includes tax id and CRM license fields", () => {
    const projection = projectRegistryProfessional({
      professionalId: "reg-pro-1",
      fullName: "Ana Paula Silva",
      socialName: "Ana",
      taxId: "52998224725",
      occupationCode: "225125",
      municipalityId: "3550308",
      employmentTypeCode: "01",
      startDate: "2020-01-01",
      terminationDate: null,
      lastUpdatedDate: "2026-01-01",
      crmCouncil: "CRM",
      crmNumber: "123456",
      crmState: "SP",
    });

    expect(projection.taxId).toBe("52998224725");
    expect(projection.crmCouncil).toBe("CRM");
    expect(projection.crmNumber).toBe("123456");
    expect(projection.crmState).toBe("SP");
  });

  it("maps registry projection into professional source upsert input", () => {
    const projection = projectRegistryProfessional({
      professionalId: "reg-pro-1",
      fullName: "Ana Paula Silva",
      socialName: "Ana",
      taxId: "52998224725",
      occupationCode: "225125",
      municipalityId: null,
      employmentTypeCode: null,
      startDate: null,
      terminationDate: null,
      lastUpdatedDate: null,
      crmCouncil: "CRM",
      crmNumber: "123456",
      crmState: "SP",
    });

    const upsert = buildProfessionalSourceUpsertFromRegistry(projection, {
      sourceProvider: "cnes-mock",
      sourceContentHash: "hash-1",
      sourceLastSeenAt: new Date("2026-06-01T00:00:00.000Z"),
      specialty: "Cardiology",
    });

    expect(upsert.externalSourceId).toBe("reg-pro-1");
    expect(upsert.firstName).toBe("Ana");
    expect(upsert.lastName).toBe("Paula Silva");
    expect(upsert.taxId).toBe("52998224725");
    expect(upsert.crmNumber).toBe("123456");
    expect(upsert.crmState).toBe("SP");
    expect(upsert.specialty).toBe("Cardiology");
  });
});
