import type { ScopeContext } from "@atlasmed/access";
import { assertResourceInScope } from "@atlasmed/access";

export interface InteractionRepositoryPort {
  findByFacility(
    facilityId: string,
    options?: { page?: number; limit?: number },
  ): Promise<Array<{
    id: string;
    type: "followup" | "presentation";
    summary: string;
    userId: string;
    agentName: string;
    facilityId: string;
    interactedAt: Date;
    createdAt: Date;
  }>>;

  countByFacility(facilityId: string): Promise<number>;

  create(input: {
    type: "followup" | "presentation";
    summary: string;
    userId: string;
    facilityId: string;
    interactedAt: Date;
  }): Promise<{
    id: string;
    type: "followup" | "presentation";
    summary: string;
    userId: string;
    agentName: string;
    facilityId: string;
    interactedAt: Date;
    createdAt: Date;
  }>;
}

export class ListFacilityInteractionsUseCase {
  constructor(private readonly deps: { interactionRepository: InteractionRepositoryPort }) {}

  async execute(input: {
    facilityId: string;
    scope: ScopeContext;
    page?: number;
    limit?: number;
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);

    const interactions = await this.deps.interactionRepository.findByFacility(
      input.facilityId,
      { page: input.page, limit: input.limit },
    );

    const total = await this.deps.interactionRepository.countByFacility(
      input.facilityId,
    );

    const totalPages = Math.ceil(total / (input.limit ?? 20));

    return {
      data: interactions.map((i) => ({
        id: i.id,
        type: i.type,
        summary: i.summary,
        agentName: i.agentName,
        interactedAt: i.interactedAt.toISOString(),
      })),
      pagination: {
        page: input.page ?? 1,
        limit: input.limit ?? 20,
        total,
        totalPages,
      },
    };
  }
}

export class CreateFacilityInteractionUseCase {
  constructor(private readonly deps: { interactionRepository: InteractionRepositoryPort }) {}

  async execute(input: {
    facilityId: string;
    userId: string;
    scope: ScopeContext;
    type: "followup" | "presentation";
    summary: string;
    interactedAt?: string;
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);

    const interactedAt = input.interactedAt
      ? new Date(input.interactedAt)
      : new Date();

    const interaction = await this.deps.interactionRepository.create({
      type: input.type,
      summary: input.summary,
      userId: input.userId,
      facilityId: input.facilityId,
      interactedAt,
    });

    return {
      id: interaction.id,
      type: interaction.type,
      summary: interaction.summary,
      agentName: interaction.agentName,
      interactedAt: interaction.interactedAt.toISOString(),
    };
  }
}
