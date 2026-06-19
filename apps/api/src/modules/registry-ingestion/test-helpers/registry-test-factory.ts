import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { MockRegistrySourceAdapter } from "../infrastructure/adapters/mock-registry-source.adapter";
import { RegistrySyncService } from "../application/services/registry-sync.service";
import {
  ApproveSuggestionUseCase,
  RejectSuggestionUseCase,
} from "../application/use-cases/suggestion.use-cases";
import {
  createRegistryIngestionRunner,
  registryIngestionRepositories,
} from "../infrastructure/demo/registry-ingestion-runner";

export { cleanupMockRegistryData } from "../infrastructure/demo/registry-mock-cleanup";
export { registryIngestionRepositories as registryTestRepositories };

const fixturesDir = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../fixtures"
);

export function createRegistryIngestionStack(fixtureName: string) {
  const registrySource = new MockRegistrySourceAdapter(fixtureName, fixturesDir);

  const registrySyncService = new RegistrySyncService({
    clinicRepository: registryIngestionRepositories.clinic,
    doctorRepository: registryIngestionRepositories.doctor,
    associationRepository: registryIngestionRepositories.association,
    suggestionRepository: registryIngestionRepositories.suggestion,
  });

  const runIngestion = createRegistryIngestionRunner(fixtureName);

  const approveSuggestion = new ApproveSuggestionUseCase({
    suggestionRepository: registryIngestionRepositories.suggestion,
    clinicRepository: registryIngestionRepositories.clinic,
    associationRepository: registryIngestionRepositories.association,
  });

  const rejectSuggestion = new RejectSuggestionUseCase({
    suggestionRepository: registryIngestionRepositories.suggestion,
    clinicRepository: registryIngestionRepositories.clinic,
    associationRepository: registryIngestionRepositories.association,
  });

  return {
    runIngestion,
    approveSuggestion,
    rejectSuggestion,
    registrySyncService,
    registrySource,
  };
}
