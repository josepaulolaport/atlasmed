import type { ScopeContext } from "@atlasmed/access";
import { assertResourceInScope } from "@atlasmed/access";

export interface VisitRepositoryPort {
  findByFacilityAndUser(
    facilityId: string,
    userId: string,
    options?: { page?: number; limit?: number },
  ): Promise<Array<{
    id: string;
    userId: string;
    facilityId: string;
    visitedAt: Date;
    type: string;
    createdAt: Date;
  }>>;

  countByFacilityAndUser(facilityId: string, userId: string): Promise<number>;

  create(input: {
    userId: string;
    facilityId: string;
    visitedAt: Date;
    type?: string;
  }): Promise<{
    id: string;
    userId: string;
    facilityId: string;
    visitedAt: Date;
    type: string;
    createdAt: Date;
  }>;
}

export class ListFacilityVisitsUseCase {
  constructor(private readonly deps: { visitRepository: VisitRepositoryPort }) {}

  async execute(input: {
    facilityId: string;
    userId: string;
    scope: ScopeContext;
    page?: number;
    limit?: number;
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);

    const visits = await this.deps.visitRepository.findByFacilityAndUser(
      input.facilityId,
      input.userId,
      { page: input.page, limit: input.limit },
    );

    const total = await this.deps.visitRepository.countByFacilityAndUser(
      input.facilityId,
      input.userId,
    );

    const totalPages = Math.ceil(total / (input.limit ?? 20));

    return {
      data: visits.map((v) => ({
        id: v.id,
        visitedAt: v.visitedAt.toISOString(),
        type: v.type,
        summary: null as string | null,
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

export class CreateFacilityVisitUseCase {
  constructor(private readonly deps: { visitRepository: VisitRepositoryPort }) {}

  async execute(input: {
    facilityId: string;
    userId: string;
    scope: ScopeContext;
    visitedAt?: string;
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);

    const visitedAt = input.visitedAt
      ? new Date(input.visitedAt)
      : new Date();

    const visit = await this.deps.visitRepository.create({
      userId: input.userId,
      facilityId: input.facilityId,
      visitedAt,
      type: "visit",
    });

    return {
      id: visit.id,
      visitedAt: visit.visitedAt.toISOString(),
      type: visit.type,
      summary: null as string | null,
    };
  }
}
