import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { auditLogService } from "../../../../infrastructure/audit/audit-log.service";
import { PrismaClinicRepository } from "../../../clinic/infrastructure/repositories/prisma/prisma-clinic.repository";
import { PrismaDoctorClinicAssociationRepository } from "../../../clinic/infrastructure/repositories/prisma/prisma-doctor-clinic-association.repository";
import { PrismaDoctorRepository } from "../../../doctor/infrastructure/repositories/prisma/prisma-doctor.repository";
import { RegistrySyncService } from "../../application/services/registry-sync.service";
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
  clinic: new PrismaClinicRepository(),
  doctor: new PrismaDoctorRepository(),
  association: new PrismaDoctorClinicAssociationRepository(),
  ingestionRun: new PrismaIngestionRunRepository(),
  suggestion: new PrismaIngestionSuggestionRepository(),
};

export function createRegistryIngestionRunner(fixtureName: string) {
  const registrySource = new MockRegistrySourceAdapter(fixtureName, fixturesDir);

  const registrySyncService = new RegistrySyncService({
    clinicRepository: sharedRepositories.clinic,
    doctorRepository: sharedRepositories.doctor,
    associationRepository: sharedRepositories.association,
    suggestionRepository: sharedRepositories.suggestion,
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
