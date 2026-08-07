import type { ScopeContext } from "@atlasmed/access";
import { assertResourceInScope } from "@atlasmed/access";

export interface VisitRepositoryPort {
  findByFacilityAndUser(
    facilityId: number,
    userId: number,
    options?: { page?: number; limit?: number },
  ): Promise<Array<{
    id: number;
    userId: number;
    facilityId: number;
    visitedAt: Date;
    createdAt: Date;
  }>>;

  countByFacilityAndUser(facilityId: number, userId: number): Promise<number>;

  create(input: {
    userId: number;
    facilityId: number;
    visitedAt: Date;
  }): Promise<{
    id: number;
    userId: number;
    facilityId: number;
    visitedAt: Date;
    createdAt: Date;
  }>;
}

export class ListFacilityVisitsUseCase {
  constructor(private readonly deps: { visitRepository: VisitRepositoryPort }) {}

  async execute(input: {
    facilityId: number;
    userId: number;
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
    facilityId: number;
    userId: number;
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
    });

    return {
      id: visit.id,
      visitedAt: visit.visitedAt.toISOString(),
      summary: null as string | null,
    };
  }
}
