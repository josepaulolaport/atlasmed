import { describe, expect, test } from "bun:test";
import type { ScopeContext } from "@atlasmed/access";
import { ForbiddenError } from "../../../../shared/errors";
import { GetWeeklyInteractionSummaryUseCase, RecordInteractionUseCase } from "./interaction.use-cases";

const scopedScope: ScopeContext = {
  isGlobal: false,
  assignedTerritoryIds: ["territory-1"],
  effectiveTerritoryIds: ["territory-1"],
  analyticsEffectiveTerritoryIds: ["territory-1"],
  territoryIds: ["territory-1"],
  facilityIds: ["clinic-1", "clinic-2"],
  analyticsFacilityIds: ["clinic-1", "clinic-2"],
  clinicIds: ["clinic-1", "clinic-2"],
  analyticsClinicIds: ["clinic-1", "clinic-2"],
  managedUserIds: [],
  isOperationallyActive: true,
};

describe("RecordInteractionUseCase", () => {
  test("denies interactions outside the current scope", async () => {
    const useCase = new RecordInteractionUseCase({
      interactionRepository: { create: async () => { throw new Error("must not create"); }, countDistinctFacilitiesForUserInPeriod: async () => 0, countFacilities: async () => 0 },
    });

    await expect(
      useCase.execute({ userId: "rep-1", facilityId: "other-clinic", type: "followup", summary: "Test", scope: scopedScope })
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("GetWeeklyInteractionSummaryUseCase", () => {
  test("returns distinct clinics and total clinics in the current scope", async () => {
    let receivedScope: string[] | undefined;
    const useCase = new GetWeeklyInteractionSummaryUseCase({
      now: () => new Date("2026-03-11T15:00:00.000Z"),
      timeZone: "America/Sao_Paulo",
      interactionRepository: {
        create: async () => ({ id: "int-1", type: "followup" as const, summary: "test", userId: "rep-1", facilityId: "clinic-1", interactedAt: new Date(), createdAt: new Date() }),
        countDistinctFacilitiesForUserInPeriod: async ({ facilityIds }) => { receivedScope = facilityIds; return 2; },
        countFacilities: async ({ facilityIds }) => { receivedScope = facilityIds; return 4; },
      },
    });

    const summary = await useCase.execute({ userId: "rep-1", scope: scopedScope });

    expect(receivedScope).toEqual(["clinic-1", "clinic-2"]);
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
