import type { RegistrySourcePort } from "../interfaces/registry-source.port";
import type { IngestionRunRepository } from "../interfaces/ingestion.repository.interface";
import { sanitizeClinicBatch } from "../sanitize/sanitize-clinic";
import { sanitizeDoctorBatch } from "../sanitize/sanitize-doctor";
import { RegistrySyncService } from "../services/registry-sync.service";
import type { AuditLogService } from "../../../../infrastructure/audit/audit-log.service";

interface Dependencies {
  registrySource: RegistrySourcePort;
  ingestionRunRepository: IngestionRunRepository;
  registrySyncService: RegistrySyncService;
  auditLogService: AuditLogService;
  acquireLock: () => Promise<boolean>;
  releaseLock: () => Promise<void>;
}

export class RunRegistryIngestionUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input?: { actorUserId?: string }) {
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

      const clinicBatch = sanitizeClinicBatch(rawSnapshot.clinics as unknown[]);
      const doctorBatch = sanitizeDoctorBatch(rawSnapshot.doctors as unknown[]);

      const snapshot = {
        ...rawSnapshot,
        clinics: clinicBatch.valid,
        doctors: doctorBatch.valid,
      };

      const syncStats = await this.deps.registrySyncService.syncSnapshot({
        snapshot,
        ingestionRunId: run.id,
      });

      const stats = {
        ...syncStats,
        invalidClinics: clinicBatch.invalidCount,
        invalidDoctors: doctorBatch.invalidCount,
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
        run: {
          id: completed.id,
          sourceProvider: completed.sourceProvider,
          status: completed.status,
          startedAt: completed.startedAt.toISOString(),
          completedAt: completed.completedAt?.toISOString(),
          stats: completed.stats,
        },
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
