import type { ClinicRepository } from "../../../clinic/application/interfaces/clinic.repository.interface";
import type { DoctorClinicAssociationRepository } from "../../../clinic/application/interfaces/doctor-clinic-association.repository.interface";
import type { DoctorRepository } from "../../../doctor/application/interfaces/doctor.repository.interface";
import type {
  IngestionSuggestionRepository,
  IngestionRunRepository,
} from "../interfaces/ingestion.repository.interface";
import type {
  RegistrySnapshot,
  SanitizedAssociationRecord,
} from "../interfaces/registry-source.port";

export interface SyncStats {
  clinicsCreated: number;
  clinicsUpdated: number;
  clinicsUnchanged: number;
  clinicsMarkedAbsent: number;
  clinicsReactivationSuggestions: number;
  doctorsCreated: number;
  doctorsUpdated: number;
  doctorsUnchanged: number;
  doctorsMarkedAbsent: number;
  associationsCreated: number;
  associationsUpdated: number;
  associationsMarkedInactive: number;
  suggestionsCreated: number;
  invalidClinics: number;
  invalidDoctors: number;
}

interface Dependencies {
  clinicRepository: ClinicRepository;
  doctorRepository: DoctorRepository;
  associationRepository: DoctorClinicAssociationRepository;
  suggestionRepository: IngestionSuggestionRepository;
  onClinicLocationChanged?: (clinicId: string) => Promise<void>;
  ensureClinicCoordinates?: (clinicId: string) => Promise<void>;
}

function associationKey(doctorExternalId: string, clinicExternalId: string): string {
  return `${doctorExternalId}:${clinicExternalId}`;
}

export class RegistrySyncService {
  constructor(private readonly deps: Dependencies) {}

  async syncSnapshot(params: {
    snapshot: RegistrySnapshot;
    ingestionRunId: string;
  }): Promise<SyncStats> {
    const stats: SyncStats = {
      clinicsCreated: 0,
      clinicsUpdated: 0,
      clinicsUnchanged: 0,
      clinicsMarkedAbsent: 0,
      clinicsReactivationSuggestions: 0,
      doctorsCreated: 0,
      doctorsUpdated: 0,
      doctorsUnchanged: 0,
      doctorsMarkedAbsent: 0,
      associationsCreated: 0,
      associationsUpdated: 0,
      associationsMarkedInactive: 0,
      suggestionsCreated: 0,
      invalidClinics: 0,
      invalidDoctors: 0,
    };

    const { snapshot, ingestionRunId } = params;
    const now = snapshot.fetchedAt;

    const clinicExternalToInternal = new Map<string, string>();
    const doctorExternalToInternal = new Map<string, string>();

    const sourceClinicIds = new Set(snapshot.clinics.map((c) => c.externalSourceId));
    const sourceDoctorIds = new Set(snapshot.doctors.map((d) => d.externalSourceId));
    const sourceAssociationKeys = new Set(
      snapshot.associations.map((a) =>
        associationKey(a.doctorExternalId, a.clinicExternalId)
      )
    );

    for (const clinic of snapshot.clinics) {
      const existing = await this.deps.clinicRepository.findByExternalId(
        snapshot.provider,
        clinic.externalSourceId
      );

      if (existing?.deletedAt) {
        await this.createSuggestionIfNew({
          type: "CLINIC_REACTIVATION",
          ingestionRunId,
          clinicId: existing.id,
          reason: "reappeared_in_source",
          payload: { externalSourceId: clinic.externalSourceId, name: clinic.name },
          stats,
        });
        stats.clinicsReactivationSuggestions += 1;
      }

      const result = await this.deps.clinicRepository.upsertFromSource({
        sourceProvider: snapshot.provider,
        externalSourceId: clinic.externalSourceId,
        name: clinic.name,
        address: clinic.address,
        lat: clinic.lat,
        lng: clinic.lng,
        sourceContentHash: clinic.contentHash,
        sourceLastSeenAt: now,
      });

      clinicExternalToInternal.set(clinic.externalSourceId, result.clinic.id);

      await this.deps.ensureClinicCoordinates?.(result.clinic.id);
      await this.deps.onClinicLocationChanged?.(result.clinic.id);

      if (result.created) {
        stats.clinicsCreated += 1;
      } else if (result.updated) {
        stats.clinicsUpdated += 1;
      } else {
        stats.clinicsUnchanged += 1;
      }

      if (existing?.deletedAt) {
        continue;
      }

      await this.deps.suggestionRepository.supersedePending({
        type: "CLINIC_REMOVAL",
        clinicId: result.clinic.id,
      });
    }

    const trackedClinics = await this.deps.clinicRepository.findSourceTrackedByProvider(
      snapshot.provider
    );

    for (const clinic of trackedClinics) {
      if (!clinic.externalSourceId || clinic.deletedAt) {
        continue;
      }

      if (!sourceClinicIds.has(clinic.externalSourceId)) {
        await this.deps.clinicRepository.markSourceAbsent(clinic.id, now);
        stats.clinicsMarkedAbsent += 1;

        await this.createSuggestionIfNew({
          type: "CLINIC_REMOVAL",
          ingestionRunId,
          clinicId: clinic.id,
          reason: "missing_from_source",
          payload: {
            externalSourceId: clinic.externalSourceId,
            name: clinic.name,
          },
          stats,
        });
      }
    }

    for (const doctor of snapshot.doctors) {
      const result = await this.deps.doctorRepository.upsertFromSource({
        sourceProvider: snapshot.provider,
        externalSourceId: doctor.externalSourceId,
        firstName: doctor.firstName,
        lastName: doctor.lastName,
        specialty: doctor.specialty,
        sourceContentHash: doctor.contentHash,
        sourceLastSeenAt: now,
      });

      doctorExternalToInternal.set(doctor.externalSourceId, result.doctor.id);

      if (result.created) {
        stats.doctorsCreated += 1;
      } else if (result.updated) {
        stats.doctorsUpdated += 1;
      } else {
        stats.doctorsUnchanged += 1;
      }
    }

    const trackedDoctors = await this.deps.doctorRepository.findSourceTrackedByProvider(
      snapshot.provider
    );

    for (const doctor of trackedDoctors) {
      if (!doctor.externalSourceId) {
        continue;
      }

      if (!sourceDoctorIds.has(doctor.externalSourceId)) {
        await this.deps.doctorRepository.markSourceAbsent(doctor.id, now);
        stats.doctorsMarkedAbsent += 1;
      }
    }

    for (const edge of snapshot.associations) {
      const doctorId = doctorExternalToInternal.get(edge.doctorExternalId);
      const clinicId = clinicExternalToInternal.get(edge.clinicExternalId);

      if (!doctorId || !clinicId) {
        continue;
      }

      const result = await this.deps.associationRepository.upsertSourceAssociation({
        doctorId,
        clinicId,
        sourceLastSeenAt: now,
      });

      if (result.created) {
        stats.associationsCreated += 1;
      } else {
        stats.associationsUpdated += 1;
      }

      await this.deps.suggestionRepository.supersedePending({
        type: "DOCTOR_CLINIC_REMOVAL",
        associationId: result.association.id,
      });
    }

    const activeSourceAssociations =
      await this.deps.associationRepository.findActiveSourceAssociationsByProvider(
        snapshot.provider
      );

    for (const row of activeSourceAssociations) {
      const key = associationKey(
        row.doctorExternalSourceId,
        row.clinicExternalSourceId
      );

      if (sourceAssociationKeys.has(key)) {
        continue;
      }

      const updated = await this.deps.associationRepository.markSourceInactive({
        associationId: row.association.id,
        sourceLastSeenAt: now,
      });

      stats.associationsMarkedInactive += 1;

      await this.createSuggestionIfNew({
        type: "DOCTOR_CLINIC_REMOVAL",
        ingestionRunId,
        clinicId: updated.clinicId,
        doctorId: updated.doctorId,
        associationId: updated.id,
        reason: "missing_from_source",
        payload: {
          confirmed: Boolean(updated.confirmedAt),
          doctorExternalSourceId: row.doctorExternalSourceId,
          clinicExternalSourceId: row.clinicExternalSourceId,
        },
        stats,
      });
    }

    return stats;
  }

  private async createSuggestionIfNew(params: {
    type: "CLINIC_REMOVAL" | "CLINIC_REACTIVATION" | "DOCTOR_CLINIC_REMOVAL";
    ingestionRunId: string;
    clinicId?: string;
    doctorId?: string;
    associationId?: string;
    reason: string;
    payload: Record<string, unknown>;
    stats: SyncStats;
  }): Promise<void> {
    const duplicate = await this.deps.suggestionRepository.findPendingDuplicate({
      type: params.type,
      clinicId: params.clinicId,
      doctorId: params.doctorId,
      associationId: params.associationId,
    });

    if (duplicate) {
      return;
    }

    await this.deps.suggestionRepository.create({
      ingestionRunId: params.ingestionRunId,
      type: params.type,
      clinicId: params.clinicId,
      doctorId: params.doctorId,
      associationId: params.associationId,
      reason: params.reason,
      payload: params.payload,
    });

    params.stats.suggestionsCreated += 1;
  }
}
