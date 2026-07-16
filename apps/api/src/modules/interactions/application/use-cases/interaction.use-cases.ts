import { assertResourceInScope, type ScopeContext } from "@atlasmed/access";
import type { InteractionRepository } from "../interfaces/interaction.repository.interface";
import { DEFAULT_APPLICATION_TIMEZONE, getMondayToMondayWeek } from "../services/week-boundary.service";

interface Dependencies {
  interactionRepository: InteractionRepository;
  now?: () => Date;
  timeZone?: string;
}

export class RecordInteractionUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    userId: string;
    facilityId: string;
    type: "followup" | "presentation";
    summary: string;
    interactedAt?: Date;
    scope: ScopeContext;
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);
    const interaction = await this.deps.interactionRepository.create({
      type: input.type,
      summary: input.summary,
      userId: input.userId,
      facilityId: input.facilityId,
      interactedAt: input.interactedAt ?? this.deps.now?.() ?? new Date(),
    });

    return {
      id: interaction.id,
      type: interaction.type,
      summary: interaction.summary,
      facilityId: interaction.facilityId,
      interactedAt: interaction.interactedAt.toISOString(),
      createdAt: interaction.createdAt.toISOString(),
    };
  }
}

export class GetWeeklyInteractionSummaryUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: { userId: string; scope: ScopeContext }) {
    const { start, end } = getMondayToMondayWeek(
      this.deps.now?.() ?? new Date(),
      this.deps.timeZone ?? DEFAULT_APPLICATION_TIMEZONE
    );
    const facilityIds = input.scope.isGlobal ? undefined : input.scope.facilityIds;
    const [distinctClinicsVisited, totalClinics] = await Promise.all([
      this.deps.interactionRepository.countDistinctFacilitiesForUserInPeriod({
        userId: input.userId,
        start,
        end,
        facilityIds,
      }),
      this.deps.interactionRepository.countFacilities({ facilityIds }),
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
