import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { auditLogService } from "../../../../infrastructure/audit/audit-log.service";
import { PrismaFacilityRepository } from "../../../facility/infrastructure/repositories/prisma/prisma-facility.repository";
import { PrismaFacilityProfessionalRepository } from "../../../facility/infrastructure/repositories/prisma/prisma-facility-professional.repository";
import { PrismaProfessionalRepository } from "../../../professional/infrastructure/repositories/prisma/prisma-professional.repository";
import { RegistrySyncService } from "../../application/services/registry-sync.service";
import { RegistryDiffService } from "../../application/services/registry-diff.service";
import { RunRegistryIngestionUseCase } from "../../application/use-cases/run-registry-ingestion.use-case";
import { MockRegistrySourceAdapter } from "../adapters/mock-registry-source.adapter";
import {
  PrismaIngestionRunRepository,
  PrismaIngestionSuggestionRepository,
} from "../repositories/prisma/prisma-ingestion.repository";

const fixturesDir = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../fixtures"
);

const sharedRepositories = {
  facility: new PrismaFacilityRepository(),
  professional: new PrismaProfessionalRepository(),
  association: new PrismaFacilityProfessionalRepository(),
  ingestionRun: new PrismaIngestionRunRepository(),
  suggestion: new PrismaIngestionSuggestionRepository(),
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
  });
}

export { sharedRepositories as registryIngestionRepositories };
