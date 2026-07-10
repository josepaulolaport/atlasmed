import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { auditLogService } from "../../../../infrastructure/audit/audit-log.service";
import { DrizzleFacilityRepository } from "../../../facility/infrastructure/repositories/drizzle/drizzle-facility.repository";
import { DrizzleFacilityProfessionalRepository } from "../../../facility/infrastructure/repositories/drizzle/drizzle-facility-professional.repository";
import { DrizzleProfessionalRepository } from "../../../professional/infrastructure/repositories/drizzle/drizzle-professional.repository";
import { RegistrySyncService } from "../../application/services/registry-sync.service";
import { RegistryDiffService } from "../../application/services/registry-diff.service";
import { RunRegistryIngestionUseCase } from "../../application/use-cases/run-registry-ingestion.use-case";
import { MockRegistrySourceAdapter } from "../adapters/mock-registry-source.adapter";
import {
  DrizzleIngestionRunRepository,
  DrizzleIngestionSuggestionRepository,
} from "../repositories/drizzle/drizzle-ingestion.repository";

const fixturesDir = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../fixtures"
);

const sharedRepositories = {
  facility: new DrizzleFacilityRepository(),
  professional: new DrizzleProfessionalRepository(),
  association: new DrizzleFacilityProfessionalRepository(),
  ingestionRun: new DrizzleIngestionRunRepository(),
  suggestion: new DrizzleIngestionSuggestionRepository(),
};

export function createRegistryIngestionRunner(fixtureName: string) {
  const registrySource = new MockRegistrySourceAdapter(fixtureName, fixturesDir);

  const registryDiffService = new RegistryDiffService({
    facilityRepository: sharedRepositories.facility,
    suggestionRepository: sharedRepositories.suggestion,
  });

  const registrySyncService = new RegistrySyncService({
    facilityRepository: sharedRepositories.facility,
    professionalRepository: sharedRepositories.professional,
    facilityProfessionalRepository: sharedRepositories.association,
    suggestionRepository: sharedRepositories.suggestion,
    registryDiffService,
  });

  return new RunRegistryIngestionUseCase({
    registrySource,
    ingestionRunRepository: sharedRepositories.ingestionRun,
    registrySyncService,
    auditLogService,
    acquireLock: async () => true,
    releaseLock: async () => {},
    registrySourceMode: "mock",
  });
}

export { sharedRepositories as registryIngestionRepositories };
