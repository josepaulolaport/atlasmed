import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { redis } from "../../infrastructure/cache/redis.client";
import { auditLogService } from "../../infrastructure/audit/audit-log.service";
import { environment } from "../../app/config/environment";
import {
  describeCnesIngestionWorkflow,
  startCnesIngestionWorkflow,
} from "../../infrastructure/temporal/temporal.client";
import { DrizzleFacilityRepository } from "../facility/infrastructure/repositories/drizzle/drizzle-facility.repository";
import { DrizzleFacilityProfessionalRepository } from "../facility/infrastructure/repositories/drizzle/drizzle-facility-professional.repository";
import { DrizzleFacilityRepresentativeRepository } from "../facility/infrastructure/repositories/drizzle/drizzle-facility-representative.repository";
import { DrizzleProfessionalRepository } from "../professional/infrastructure/repositories/drizzle/drizzle-professional.repository";
import { MockRegistrySourceAdapter } from "./infrastructure/adapters/mock-registry-source.adapter";
import {
  DrizzleIngestionRunRepository,
  DrizzleIngestionSuggestionRepository,
} from "./infrastructure/repositories/drizzle/drizzle-ingestion.repository";
import { DrizzleRegistryReadRepository } from "./infrastructure/repositories/drizzle/drizzle-registry-read.repository";
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
import { GetIngestionRunStatusUseCase } from "./application/use-cases/get-ingestion-run-status.use-case";
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
  facility: new DrizzleFacilityRepository(),
  professional: new DrizzleProfessionalRepository(),
  association: new DrizzleFacilityProfessionalRepository(),
  ingestionRun: new DrizzleIngestionRunRepository(),
  suggestion: new DrizzleIngestionSuggestionRepository(),
  registryRead: new DrizzleRegistryReadRepository(),
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
      registrySourceMode: environment.REGISTRY_SOURCE,
      startTemporalWorkflow: startCnesIngestionWorkflow,
    }),
  listRuns: () =>
    new ListIngestionRunsUseCase({
      ingestionRunRepository: registryIngestionRepositories.ingestionRun,
    }),
  getRunStatus: () =>
    new GetIngestionRunStatusUseCase({
      ingestionRunRepository: registryIngestionRepositories.ingestionRun,
      describeWorkflow: async (workflowId) => {
        const description = await describeCnesIngestionWorkflow(workflowId);
        return {
          status: { name: description.status.name },
          runId: description.runId,
        };
      },
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
      professionalRepository: registryIngestionRepositories.professional,
      facilityProfessionalRepository: registryIngestionRepositories.association,
      facilityRepresentativeRepository: new DrizzleFacilityRepresentativeRepository(),
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
