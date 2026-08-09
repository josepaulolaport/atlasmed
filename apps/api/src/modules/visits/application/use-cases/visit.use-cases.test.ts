import { describe, expect, test } from "bun:test";
import { ForbiddenError, type ScopeContext } from "@atlasmed/access";
import { GetWeeklyVisitSummaryUseCase, RecordVisitUseCase } from "./visit.use-cases";

const scopedScope: ScopeContext = {
  isGlobal: false,
  assignedTerritoryIds: [1],
  effectiveTerritoryIds: [1],
  analyticsEffectiveTerritoryIds: [1],
  territoryIds: [1],
  facilityIds: [1, 2],
  analyticsFacilityIds: [1, 2],
  clinicIds: [1, 2],
  analyticsClinicIds: [1, 2],
  managedUserIds: [],
  isOperationallyActive: true,
};

describe("RecordVisitUseCase", () => {
  test("denies visits outside the current scope", async () => {
    const useCase = new RecordVisitUseCase({
      visitRepository: { create: async () => { throw new Error("must not create"); }, countDistinctFacilitiesForUserInPeriod: async () => 0, countFacilities: async () => 0 },
    });

    await expect(
      useCase.execute({ userId: 1, facilityId: 99, scope: scopedScope })
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("GetWeeklyVisitSummaryUseCase", () => {
  test("returns distinct clinics and total clinics in the current scope", async () => {
    let receivedScope: number[] | undefined;
    const useCase = new GetWeeklyVisitSummaryUseCase({
      now: () => new Date("2026-03-11T15:00:00.000Z"),
      timeZone: "America/Sao_Paulo",
      visitRepository: {
        create: async () => ({ id: 1, userId: 1, facilityId: 1, visitedAt: new Date(), createdAt: new Date() }),
        countDistinctFacilitiesForUserInPeriod: async ({ facilityIds }) => { receivedScope = facilityIds; return 2; },
        countFacilities: async ({ facilityIds }) => { receivedScope = facilityIds; return 4; },
      },
    });

    const summary = await useCase.execute({ userId: 1, scope: scopedScope });

    expect(receivedScope).toEqual([1, 2]);
    expect(summary).toEqual({
      distinctClinicsVisited: 2,
      totalClinics: 4,
      coveragePercentage: 50,
      weekStart: "2026-03-09T03:00:00.000Z",
      weekEnd: "2026-03-16T03:00:00.000Z",
      timeZone: "America/Sao_Paulo",
    });
  });
});
