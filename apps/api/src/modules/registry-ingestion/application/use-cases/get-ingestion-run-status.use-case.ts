import type { IngestionRunRepository } from "../interfaces/ingestion.repository.interface";

interface Dependencies {
  ingestionRunRepository: IngestionRunRepository;
  describeWorkflow?: (workflowId: string) => Promise<{
    status: { name: string };
    runId: string;
  }>;
}

export class GetIngestionRunStatusUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: { runId: string }) {
    const run = await this.deps.ingestionRunRepository.findById(input.runId);
    if (!run) {
      return null;
    }

    let temporal:
      | {
          workflowId: string;
          status: string;
          runId: string;
        }
      | undefined;

    if (run.temporalWorkflowId && this.deps.describeWorkflow) {
      try {
        const description = await this.deps.describeWorkflow(run.temporalWorkflowId);
        temporal = {
          workflowId: run.temporalWorkflowId,
          status: description.status.name,
          runId: description.runId,
        };
      } catch {
        temporal = undefined;
      }
    }

    return {
      run: {
        id: run.id,
        sourceProvider: run.sourceProvider,
        status: run.status,
        phase: run.phase,
        temporalWorkflowId: run.temporalWorkflowId,
        referenceAno: run.referenceAno,
        referenceMes: run.referenceMes,
        startedAt: run.startedAt.toISOString(),
        completedAt: run.completedAt?.toISOString() ?? null,
        promotedAt: run.promotedAt?.toISOString() ?? null,
        stats: run.stats,
        validationReport: run.validationReport,
        archiveManifest: run.archiveManifest,
        error: run.error,
      },
      temporal,
    };
  }
}
