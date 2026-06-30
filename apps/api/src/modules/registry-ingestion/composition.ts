import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { redis } from "../../infrastructure/cache/redis.client";
import { auditLogService } from "../../infrastructure/audit/audit-log.service";
import { environment } from "../../app/config/environment";
import { PrismaFacilityRepository } from "../facility/infrastructure/repositories/prisma/prisma-facility.repository";
import { PrismaFacilityProfessionalRepository } from "../facility/infrastructure/repositories/prisma/prisma-facility-professional.repository";
import { PrismaProfessionalRepository } from "../professional/infrastructure/repositories/prisma/prisma-professional.repository";
import { MockRegistrySourceAdapter } from "./infrastructure/adapters/mock-registry-source.adapter";
import {
  PrismaIngestionRunRepository,
  PrismaIngestionSuggestionRepository,
} from "./infrastructure/repositories/prisma/prisma-ingestion.repository";
import { PrismaRegistryReadRepository } from "./infrastructure/repositories/prisma/prisma-registry-read.repository";
import { RegistrySyncService } from "./application/services/registry-sync.service";
import { RegistryDiffService } from "./application/services/registry-diff.service";
import { RegistryReadService } from "./application/services/registry-read.service";
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
import { facilityGeocodingService } from "../facility/composition";

const INGESTION_LOCK_KEY = `${environment.REDIS_KEY_PREFIX}ingestion:registry:lock`;
const INGESTION_LOCK_TTL_SECONDS = 300;

const fixturesDir = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "fixtures"
);

export const registryIngestionRepositories = {
  facility: new PrismaFacilityRepository(),
  professional: new PrismaProfessionalRepository(),
  association: new PrismaFacilityProfessionalRepository(),
  ingestionRun: new PrismaIngestionRunRepository(),
  suggestion: new PrismaIngestionSuggestionRepository(),
  registryRead: new PrismaRegistryReadRepository(),
};

const registrySource = new MockRegistrySourceAdapter(
  environment.REGISTRY_MOCK_FIXTURE,
  fixturesDir
);

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

export const registryReadService = new RegistryReadService({
  facilityRepository: registryIngestionRepositories.facility,
  registryReadRepository: registryIngestionRepositories.registryRead,
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
      facilityRepository: registryIngestionRepositories.facility,
      facilityProfessionalRepository: registryIngestionRepositories.association,
    }),
  getSuggestion: () =>
    new GetSuggestionUseCase({
      suggestionRepository: registryIngestionRepositories.suggestion,
      facilityRepository: registryIngestionRepositories.facility,
      facilityProfessionalRepository: registryIngestionRepositories.association,
    }),
  approveSuggestion: () =>
    new ApproveSuggestionUseCase({
      suggestionRepository: registryIngestionRepositories.suggestion,
      facilityRepository: registryIngestionRepositories.facility,
      facilityProfessionalRepository: registryIngestionRepositories.association,
      facilityGeocodingService,
      auditLogService,
    }),
  rejectSuggestion: () =>
    new RejectSuggestionUseCase({
      suggestionRepository: registryIngestionRepositories.suggestion,
      facilityRepository: registryIngestionRepositories.facility,
      facilityProfessionalRepository: registryIngestionRepositories.association,
      auditLogService,
    }),
  runDemo: () =>
    new RunRegistryDemoUseCase({
      createRunner: createRegistryIngestionRunner,
      cleanupMockData: cleanupMockRegistryData,
      suggestionRepository: demoRegistryRepositories.suggestion,
    }),
};
