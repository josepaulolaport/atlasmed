import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { MockRegistrySourceAdapter } from "../infrastructure/adapters/mock-registry-source.adapter";
import { RegistryDiffService } from "../application/services/registry-diff.service";
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

  const registryDiffService = new RegistryDiffService({
    facilityRepository: registryIngestionRepositories.facility,
    suggestionRepository: registryIngestionRepositories.suggestion,
  });

  const registrySyncService = new RegistrySyncService({
    facilityRepository: registryIngestionRepositories.facility,
    professionalRepository: registryIngestionRepositories.professional,
    facilityProfessionalRepository: registryIngestionRepositories.association,
    suggestionRepository: registryIngestionRepositories.suggestion,
    registryDiffService,
  });

  const runIngestion = createRegistryIngestionRunner(fixtureName);

  const approveSuggestion = new ApproveSuggestionUseCase({
    suggestionRepository: registryIngestionRepositories.suggestion,
    facilityRepository: registryIngestionRepositories.facility,
    facilityProfessionalRepository: registryIngestionRepositories.association,
  });

  const rejectSuggestion = new RejectSuggestionUseCase({
    suggestionRepository: registryIngestionRepositories.suggestion,
    facilityRepository: registryIngestionRepositories.facility,
    facilityProfessionalRepository: registryIngestionRepositories.association,
  });

  return {
    runIngestion,
    approveSuggestion,
    rejectSuggestion,
    registrySyncService,
    registrySource,
  };
}
