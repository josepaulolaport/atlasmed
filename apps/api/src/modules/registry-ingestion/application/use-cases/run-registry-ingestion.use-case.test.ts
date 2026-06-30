import { describe, expect, it, mock } from "bun:test";
import { RunRegistryIngestionUseCase } from "./run-registry-ingestion.use-case";
import type { RegistrySourcePort } from "../interfaces/registry-source.port";
import type { IngestionRunRepository } from "../interfaces/ingestion.repository.interface";
import { RegistrySyncService } from "../services/registry-sync.service";
import type { AuditLogService } from "../../../../infrastructure/audit/audit-log.service";

describe("RunRegistryIngestionUseCase", () => {
  it("returns skipped when lock is not acquired", async () => {
    const useCase = new RunRegistryIngestionUseCase({
      registrySource: { fetchSnapshot: mock(async () => { throw new Error("not called"); }) } as RegistrySourcePort,
      ingestionRunRepository: {} as IngestionRunRepository,
      registrySyncService: {} as RegistrySyncService,
      auditLogService: { log: mock(async () => {}) } as unknown as AuditLogService,
      acquireLock: async () => false,
      releaseLock: mock(async () => {}),
    });

    const result = await useCase.execute();

    expect(result).toEqual({
      skipped: true,
      reason: "ingestion_already_running",
    });
  });

  it("runs ingestion and completes run when lock acquired", async () => {
    const releaseLock = mock(async () => {});

    const registrySource: RegistrySourcePort = {
      fetchSnapshot: mock(async () => ({
        provider: "mock_registry",
        fetchedAt: new Date("2024-01-01"),
        facilities: [
          {
            externalSourceId: "c1",
            name: "Clinic",
            address: null,
            lat: null,
            lng: null,
            contentHash: "hash",
          },
        ],
        doctors: [],
        associations: [],
      })),
    };

    const ingestionRunRepository: IngestionRunRepository = {
      create: mock(async () => ({
        id: "run-1",
        sourceProvider: "mock_registry",
        status: "RUNNING" as const,
        startedAt: new Date("2024-01-01"),
        completedAt: null,
        stats: null,
        error: null,
      })),
      complete: mock(async (_id, stats) => ({
        id: "run-1",
        sourceProvider: "mock_registry",
        status: "COMPLETED" as const,
        startedAt: new Date("2024-01-01"),
        completedAt: new Date("2024-01-01"),
        stats,
        error: null,
      })),
      fail: mock(async () => {
        throw new Error("not used");
      }),
      findRecent: mock(async () => ({ runs: [], total: 0 })),
    };

    const registrySyncService = {
      syncSnapshot: mock(async () => ({
        facilitiesCreated: 1,
        facilitiesUpdated: 0,
        facilitiesUnchanged: 0,
        facilitiesMarkedAbsent: 0,
        facilitiesReactivationSuggestions: 0,
        professionalsCreated: 0,
        professionalsUpdated: 0,
        professionalsUnchanged: 0,
        professionalsMarkedAbsent: 0,
        associationsCreated: 0,
        associationsUpdated: 0,
        associationsMarkedInactive: 0,
        suggestionsCreated: 0,
        fieldUpdateSuggestions: 0,
        invalidFacilities: 0,
        invalidProfessionals: 0,
      })),
    } as unknown as RegistrySyncService;

    const auditLog = mock(async () => {});

    const useCase = new RunRegistryIngestionUseCase({
      registrySource,
      ingestionRunRepository,
      registrySyncService,
      auditLogService: { log: auditLog } as unknown as AuditLogService,
      acquireLock: async () => true,
      releaseLock,
    });

    const result = await useCase.execute({ actorUserId: "admin-1" });

    expect(result.skipped).toBe(false);
    if (!result.skipped) {
      expect(result.run.status).toBe("COMPLETED");
    }
    expect(registrySyncService.syncSnapshot).toHaveBeenCalled();
    expect(releaseLock).toHaveBeenCalled();
    expect(auditLog).toHaveBeenCalled();
  });
});
