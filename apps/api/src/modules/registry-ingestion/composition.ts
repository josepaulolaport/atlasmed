import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { redis } from "../../infrastructure/cache/redis.client";
import { auditLogService } from "../../infrastructure/audit/audit-log.service";
import { environment } from "../../app/config/environment";
import { PrismaClinicRepository } from "../clinic/infrastructure/repositories/prisma/prisma-clinic.repository";
import { PrismaDoctorClinicAssociationRepository } from "../clinic/infrastructure/repositories/prisma/prisma-doctor-clinic-association.repository";
import { PrismaDoctorRepository } from "../doctor/infrastructure/repositories/prisma/prisma-doctor.repository";
import { MockRegistrySourceAdapter } from "./infrastructure/adapters/mock-registry-source.adapter";
import {
  PrismaIngestionRunRepository,
  PrismaIngestionSuggestionRepository,
} from "./infrastructure/repositories/prisma/prisma-ingestion.repository";
import { RegistrySyncService } from "./application/services/registry-sync.service";
import { RunRegistryIngestionUseCase } from "./application/use-cases/run-registry-ingestion.use-case";
import {
  ApproveSuggestionUseCase,
  GetSuggestionUseCase,
  ListSuggestionsUseCase,
  RejectSuggestionUseCase,
} from "./application/use-cases/suggestion.use-cases";
import { ListIngestionRunsUseCase } from "./application/use-cases/list-ingestion-runs.use-case";
import { RunRegistryDemoUseCase } from "./application/use-cases/run-registry-demo.use-case";
import { cleanupMockRegistryData } from "./infrastructure/demo/registry-mock-cleanup";
import {
  createRegistryIngestionRunner,
  registryIngestionRepositories as demoRegistryRepositories,
} from "./infrastructure/demo/registry-ingestion-runner";
import { territoryMembershipService } from "../territory/composition";
import { clinicGeocodingService } from "../clinic/composition";

const INGESTION_LOCK_KEY = `${environment.REDIS_KEY_PREFIX}ingestion:registry:lock`;
const INGESTION_LOCK_TTL_SECONDS = 300;

const fixturesDir = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "fixtures"
);

export const registryIngestionRepositories = {
  clinic: new PrismaClinicRepository(),
  doctor: new PrismaDoctorRepository(),
  association: new PrismaDoctorClinicAssociationRepository(),
  ingestionRun: new PrismaIngestionRunRepository(),
  suggestion: new PrismaIngestionSuggestionRepository(),
};

const registrySource = new MockRegistrySourceAdapter(
  environment.REGISTRY_MOCK_FIXTURE,
  fixturesDir
);

const registrySyncService = new RegistrySyncService({
  clinicRepository: registryIngestionRepositories.clinic,
  doctorRepository: registryIngestionRepositories.doctor,
  associationRepository: registryIngestionRepositories.association,
  suggestionRepository: registryIngestionRepositories.suggestion,
  ensureClinicCoordinates: (clinicId) =>
    clinicGeocodingService.ensureCoordinatesPersisted(clinicId).then(() => undefined),
  onClinicLocationChanged: (clinicId) => territoryMembershipService.assignClinicById(clinicId),
});

async function acquireIngestionLock(): Promise<boolean> {
  const result = await redis.set(
    INGESTION_LOCK_KEY,
    "1",
    "EX",
    INGESTION_LOCK_TTL_SECONDS,
    "NX"
  );
  return result === "OK";
}

async function releaseIngestionLock(): Promise<void> {
  await redis.del(INGESTION_LOCK_KEY);
}

export const registryIngestionUseCases = {
  runIngestion: () =>
    new RunRegistryIngestionUseCase({
      registrySource,
      ingestionRunRepository: registryIngestionRepositories.ingestionRun,
      registrySyncService,
      auditLogService,
      acquireLock: acquireIngestionLock,
      releaseLock: releaseIngestionLock,
    }),
  listRuns: () =>
    new ListIngestionRunsUseCase({
      ingestionRunRepository: registryIngestionRepositories.ingestionRun,
    }),
  listSuggestions: () =>
    new ListSuggestionsUseCase({
      suggestionRepository: registryIngestionRepositories.suggestion,
      clinicRepository: registryIngestionRepositories.clinic,
      associationRepository: registryIngestionRepositories.association,
    }),
  getSuggestion: () =>
    new GetSuggestionUseCase({
      suggestionRepository: registryIngestionRepositories.suggestion,
      clinicRepository: registryIngestionRepositories.clinic,
      associationRepository: registryIngestionRepositories.association,
    }),
  approveSuggestion: () =>
    new ApproveSuggestionUseCase({
      suggestionRepository: registryIngestionRepositories.suggestion,
      clinicRepository: registryIngestionRepositories.clinic,
      associationRepository: registryIngestionRepositories.association,
      auditLogService,
    }),
  rejectSuggestion: () =>
    new RejectSuggestionUseCase({
      suggestionRepository: registryIngestionRepositories.suggestion,
      clinicRepository: registryIngestionRepositories.clinic,
      associationRepository: registryIngestionRepositories.association,
      auditLogService,
    }),
  runDemo: () =>
    new RunRegistryDemoUseCase({
      createRunner: createRegistryIngestionRunner,
      cleanupMockData: cleanupMockRegistryData,
      suggestionRepository: demoRegistryRepositories.suggestion,
    }),
};
