import type { IngestionRunRepository } from "../interfaces/ingestion.repository.interface";

interface Dependencies {
  ingestionRunRepository: IngestionRunRepository;
}

export class ListIngestionRunsUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input?: { page?: number; limit?: number; sourceProvider?: string }) {
    const page = input?.page ?? 1;
    const limit = input?.limit ?? 20;

    const { runs, total } = await this.deps.ingestionRunRepository.findRecent({
      page,
      limit,
      sourceProvider: input?.sourceProvider,
    });

    return {
      data: runs.map((run) => ({
        id: run.id,
        sourceProvider: run.sourceProvider,
        status: run.status,
        startedAt: run.startedAt.toISOString(),
        completedAt: run.completedAt?.toISOString(),
        stats: run.stats,
        error: run.error,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }
}
