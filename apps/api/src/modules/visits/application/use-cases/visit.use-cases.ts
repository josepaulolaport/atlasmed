import { assertResourceInScope, type ScopeContext } from "@atlasmed/access";
import type { VisitRepository } from "../interfaces/visit.repository.interface";
import { DEFAULT_APPLICATION_TIMEZONE, getMondayToMondayWeek } from "../services/week-boundary.service";

interface Dependencies {
  visitRepository: VisitRepository;
  now?: () => Date;
  timeZone?: string;
}

export class RecordVisitUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: { userId: number; facilityId: number; visitedAt?: Date; scope: ScopeContext }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);
    const visit = await this.deps.visitRepository.create({
      userId: input.userId,
      facilityId: input.facilityId,
      visitedAt: input.visitedAt ?? this.deps.now?.() ?? new Date(),
    });

    return {
      id: visit.id,
      facilityId: visit.facilityId,
      visitedAt: visit.visitedAt.toISOString(),
      createdAt: visit.createdAt.toISOString(),
    };
  }
}

export class GetWeeklyVisitSummaryUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: { userId: number; scope: ScopeContext }) {
    const { start, end } = getMondayToMondayWeek(
      this.deps.now?.() ?? new Date(),
      this.deps.timeZone ?? DEFAULT_APPLICATION_TIMEZONE
    );
    const facilityIds = input.scope.isGlobal ? undefined : input.scope.facilityIds;
    const [distinctClinicsVisited, totalClinics] = await Promise.all([
      this.deps.visitRepository.countDistinctFacilitiesForUserInPeriod({
        userId: input.userId,
        start,
        end,
        facilityIds,
      }),
      this.deps.visitRepository.countFacilities({ facilityIds }),
    ]);

    return {
      distinctClinicsVisited,
      totalClinics,
      coveragePercentage: totalClinics === 0 ? 0 : (distinctClinicsVisited / totalClinics) * 100,
      weekStart: start.toISOString(),
      weekEnd: end.toISOString(),
      timeZone: this.deps.timeZone ?? DEFAULT_APPLICATION_TIMEZONE,
    };
  }
}
