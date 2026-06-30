import type { IngestionSuggestionRepository } from "../interfaces/ingestion.repository.interface";
import type { RunRegistryIngestionUseCase } from "./run-registry-ingestion.use-case";

export const REGISTRY_DEMO_FIXTURES = [
  {
    fixture: "snapshot-v1.json",
    label: "Load baseline registry snapshot",
  },
  {
    fixture: "snapshot-v2-missing-clinic.json",
    label: "Alpha Medical Center disappears from source",
  },
  {
    fixture: "snapshot-v4-dropped-association.json",
    label: "John Doe no longer linked to Alpha Medical Center",
  },
] as const;

interface Dependencies {
  createRunner: (fixtureName: string) => RunRegistryIngestionUseCase;
  cleanupMockData: () => Promise<void>;
  suggestionRepository: IngestionSuggestionRepository;
}

export class RunRegistryDemoUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input?: { actorUserId?: string }) {
    await this.deps.cleanupMockData();

    const steps: Array<{
      fixture: string;
      label: string;
      skipped: boolean;
      reason?: string;
      runId?: string;
      suggestionsCreated?: number;
    }> = [];

    for (const step of REGISTRY_DEMO_FIXTURES) {
      const result = await this.deps.createRunner(step.fixture).execute({
        actorUserId: input?.actorUserId,
      });

      if (result.skipped) {
        steps.push({
          fixture: step.fixture,
          label: step.label,
          skipped: true,
          reason: result.reason,
        });
        continue;
      }

      steps.push({
        fixture: step.fixture,
        label: step.label,
        skipped: false,
        runId: result.run.id,
        suggestionsCreated:
          typeof result.run.stats?.suggestionsCreated === "number"
            ? result.run.stats.suggestionsCreated
            : 0,
      });
    }

    const { suggestions, total } = await this.deps.suggestionRepository.findAll({
      status: "PENDING",
      page: 1,
      limit: 100,
    });

    return {
      steps,
      pendingSuggestions: suggestions.map((suggestion) => ({
        id: suggestion.id,
        type: suggestion.type,
        reason: suggestion.reason ?? undefined,
        facilityId: suggestion.facilityId ?? undefined,
        professionalId: suggestion.professionalId ?? undefined,
        payload: suggestion.payload,
        suggestedAt: suggestion.suggestedAt.toISOString(),
      })),
      summary: {
        pendingCount: total,
        clinicRemovals: suggestions.filter((s) => s.type === "FACILITY_REGISTRY_DEACTIVATED").length,
        clinicReactivations: suggestions.filter((s) => s.type === "FACILITY_REGISTRY_REACTIVATED")
          .length,
        facilityProfessionalRemovals: suggestions.filter(
          (s) => s.type === "FACILITY_PROFESSIONAL_REMOVAL"
        ).length,
      },
    };
  }
}
