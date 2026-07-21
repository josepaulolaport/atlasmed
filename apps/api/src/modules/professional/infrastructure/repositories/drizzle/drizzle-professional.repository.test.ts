import { beforeEach, describe, expect, it, mock } from "bun:test";
import { drizzle } from "drizzle-orm/pg-proxy";

const executedSql: string[] = [];
const proxyDb = drizzle(async (query) => {
  executedSql.push(query);

  if (query.includes("count(*)")) return { rows: [[1]] };
  if (query.includes('from "professionals"')) {
    return {
      rows: [[
        "professional-1",
        "Ana",
        "Silva",
        "Ana Silva",
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        "Cardiologia",
        "CRM",
        "123",
        "SP",
        null,
        null,
        null,
        null,
        null,
        false,
        false,
        null,
        null,
        new Date("2026-01-01"),
        new Date("2026-01-01"),
        null,
      ]],
    };
  }

  return { rows: [] };
});

mock.module("../../../../../infrastructure/database/db", () => ({ db: proxyDb }));

const { DrizzleProfessionalRepository } = await import("./drizzle-professional.repository");

function normalizedSql(): string {
  return executedSql.join(" ").replaceAll('"', "").replace(/\s+/g, " ").toLowerCase();
}

const repository = new DrizzleProfessionalRepository();

beforeEach(() => {
  executedSql.length = 0;
});

describe("DrizzleProfessionalRepository.findAll active facility associations", () => {
  it("does not grant scope or hydrate facilityIds through deactivated facilities", async () => {
    await repository.findAll({
      page: 1,
      limit: 20,
      scope: { isGlobal: false, facilityIds: ["facility-deactivated"] },
    });

    const sql = normalizedSql();
    expect(sql).toContain("select facility_professionals.professional_id, facility_professionals.facility_id, facility_professionals.ended_at from facility_professionals inner join facilities");
    expect(sql.match(/facilities\.deactivated_at is null/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("does not satisfy facilityId through a deactivated facility", async () => {
    await repository.findAll({
      page: 1,
      limit: 20,
      facilityId: "facility-deactivated",
      scope: { isGlobal: true },
    });

    const sql = normalizedSql();
    expect(sql).toContain("select facility_professionals.professional_id, facility_professionals.facility_id, facility_professionals.ended_at from facility_professionals inner join facilities");
    expect(sql.match(/facilities\.deactivated_at is null/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("does not satisfy radius or calculate distance through deactivated facilities", async () => {
    await repository.findAll({
      page: 1,
      limit: 20,
      latitude: -23.5505,
      longitude: -46.6333,
      radiusKm: 5,
      scope: { isGlobal: true },
    });

    const sql = normalizedSql();
    expect(sql).toContain("f.deactivated_at is null");
    expect(sql).toContain("facilities.deactivated_at is null");
  });
});


describe("Professional source upsert manual edit protection", () => {
  it("skips overwriting person fields when manuallyEditedAt is set", () => {
    const existing = {
      manuallyEditedAt: new Date("2026-01-01"),
      sourceContentHash: "hash-1",
    };

    const sourcePersonFields = {
      firstName: "Source",
      lastName: "Name",
      fullName: "Source Name",
      socialName: "Source Social",
      taxId: "52998224725",
      primarySpecialtyLabel: "Cardiology",
      crmCouncil: "CRM",
      crmNumber: "123456",
      crmState: "SP",
    };

    const input = {
      ...sourcePersonFields,
      sourceContentHash: "hash-2",
      sourceLastSeenAt: new Date(),
    };

    const updateData: Record<string, unknown> = {
      sourceContentHash: input.sourceContentHash,
      sourceLastSeenAt: input.sourceLastSeenAt,
      sourcePresent: true,
      sourceTracked: true,
    };

    if (!existing.manuallyEditedAt) {
      Object.assign(updateData, sourcePersonFields);
    }

    expect(updateData.firstName).toBeUndefined();
    expect(updateData.taxId).toBeUndefined();
    expect(updateData.crmNumber).toBeUndefined();
    expect(updateData.sourceContentHash).toBe("hash-2");
  });
});
