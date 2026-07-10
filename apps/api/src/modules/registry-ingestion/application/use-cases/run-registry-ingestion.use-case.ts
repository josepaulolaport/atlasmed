import type { RegistrySourcePort } from "../interfaces/registry-source.port";
import type { IngestionRunRepository } from "../interfaces/ingestion.repository.interface";
import { sanitizeFacilityBatch } from "../sanitize/sanitize-facility";
import { sanitizeProfessionalBatch } from "../sanitize/sanitize-professional";
import { RegistrySyncService } from "../services/registry-sync.service";
import type { AuditLogService } from "../../../../infrastructure/audit/audit-log.service";
import { ConfigurationError } from "../../../../shared/errors";
import { tracer } from "../../../../infrastructure/tracing/tracer";

interface Dependencies {
  registrySource: RegistrySourcePort;
  ingestionRunRepository: IngestionRunRepository;
  registrySyncService: RegistrySyncService;
  auditLogService: AuditLogService;
  acquireLock: () => Promise<boolean>;
  releaseLock: () => Promise<void>;
  registrySourceMode: "mock" | "temporal";
  startTemporalWorkflow?: (input: {
    ingestionRunId: string;
    ano?: number;
    mes?: number;
  }) => Promise<{ workflowId: string }>;
}

function mapRunResponse(run: {
  id: string;
  sourceProvider: string;
  status: string;
  phase?: string | null;
  temporalWorkflowId?: string | null;
  referenceAno?: number | null;
  referenceMes?: number | null;
  startedAt: Date;
  completedAt: Date | null;
  stats: Record<string, unknown> | null;
}) {
  return {
    id: run.id,
    sourceProvider: run.sourceProvider,
    status: run.status,
    phase: run.phase ?? null,
    temporalWorkflowId: run.temporalWorkflowId ?? null,
    referenceAno: run.referenceAno ?? null,
    referenceMes: run.referenceMes ?? null,
    startedAt: run.startedAt.toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null,
    stats: run.stats,
  };
}

export class RunRegistryIngestionUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input?: { actorUserId?: string; ano?: number; mes?: number }) {
    return tracer.with(
      "registry.ingestion.run",
      async () => {
        if (this.deps.registrySourceMode === "temporal") {
          return this.executeTemporal(input);
        }

        return this.executeMock(input);
      },
      {
        "app.module": "registry",
        ...(input?.actorUserId ? { "user.id": input.actorUserId } : {}),
      }
    );
  }

  private async executeTemporal(input?: { actorUserId?: string; ano?: number; mes?: number }) {
    if (!this.deps.startTemporalWorkflow) {
      throw new ConfigurationError("Temporal workflow starter is not configured");
    }

    const ano = input?.ano ?? new Date().getFullYear();
    const mes = input?.mes ?? new Date().getMonth() + 1;
    const workflowId = `cnes-ingestion-${ano}-${String(mes).padStart(2, "0")}`;

    const run = await this.deps.ingestionRunRepository.create("cnes", {
      temporalWorkflowId: workflowId,
      referenceAno: ano,
      referenceMes: mes,
    });

    const started = await this.deps.startTemporalWorkflow({
      ingestionRunId: run.id,
      ano: input?.ano,
      mes: input?.mes,
    });

    await this.deps.auditLogService.log({
      userId: input?.actorUserId,
      eventType: "REGISTRY_INGESTION_STARTED",
      action: "registry_ingestion_started",
      resource: "registry_ingestion",
      resourceId: run.id,
      details: { workflowId: started.workflowId },
    });

    return {
      skipped: false as const,
      mode: "temporal" as const,
      workflowId: started.workflowId,
      run: mapRunResponse({
        ...run,
        temporalWorkflowId: started.workflowId,
      }),
    };
  }

  private async executeMock(input?: { actorUserId?: string }) {
    const locked = await this.deps.acquireLock();
    if (!locked) {
      return {
        skipped: true as const,
        reason: "ingestion_already_running",
      };
    }

    let runId: string | undefined;

    try {
      const rawSnapshot = await this.deps.registrySource.fetchSnapshot();
      const run = await this.deps.ingestionRunRepository.create(rawSnapshot.provider);
      runId = run.id;

      const facilityBatch = sanitizeFacilityBatch(rawSnapshot.facilities as unknown[]);
      const professionalBatch = sanitizeProfessionalBatch(rawSnapshot.doctors as unknown[]);

      const snapshot = {
        ...rawSnapshot,
        facilities: facilityBatch.valid,
        doctors: professionalBatch.valid,
      };

      const syncStats = await this.deps.registrySyncService.syncSnapshot({
        snapshot,
        ingestionRunId: run.id,
      });

      const stats = {
        ...syncStats,
        invalidFacilities: facilityBatch.invalidCount,
        invalidProfessionals: professionalBatch.invalidCount,
      };

      const completed = await this.deps.ingestionRunRepository.complete(run.id, stats);

      await this.deps.auditLogService.log({
        userId: input?.actorUserId,
        eventType: "REGISTRY_INGESTION_COMPLETED",
        action: "registry_ingestion_completed",
        resource: "registry_ingestion",
        resourceId: completed.id,
        details: stats,
      });

      return {
        skipped: false as const,
        mode: "mock" as const,
        run: mapRunResponse(completed),
      };
    } catch (error) {
      if (runId) {
        await this.deps.ingestionRunRepository.fail(
          runId,
          error instanceof Error ? error.message : String(error)
        );
      }
      throw error;
    } finally {
      await this.deps.releaseLock();
    }
  }
}
