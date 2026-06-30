import type { FacilityRepository } from "../../../facility/application/interfaces/facility.repository.interface";
import type { FacilityProfessionalRepository } from "../../../facility/application/interfaces/facility-professional.repository.interface";
import type { ProfessionalRepository } from "../../../professional/application/interfaces/professional.repository.interface";
import type { IngestionSuggestionRepository } from "../interfaces/ingestion.repository.interface";
import type { RegistrySnapshot } from "../interfaces/registry-source.port";
import type { RegistryDiffService } from "./registry-diff.service";

export interface SyncStats {
  facilitiesCreated: number;
  facilitiesUpdated: number;
  facilitiesUnchanged: number;
  facilitiesMarkedAbsent: number;
  facilitiesReactivationSuggestions: number;
  professionalsCreated: number;
  professionalsUpdated: number;
  professionalsUnchanged: number;
  professionalsMarkedAbsent: number;
  associationsCreated: number;
  associationsUpdated: number;
  associationsMarkedInactive: number;
  suggestionsCreated: number;
  fieldUpdateSuggestions: number;
  invalidFacilities: number;
  invalidProfessionals: number;
}

interface Dependencies {
  facilityRepository: FacilityRepository;
  professionalRepository: ProfessionalRepository;
  facilityProfessionalRepository: FacilityProfessionalRepository;
  suggestionRepository: IngestionSuggestionRepository;
  registryDiffService: RegistryDiffService;
}

function associationKey(professionalExternalId: string, facilityExternalId: string): string {
  return `${professionalExternalId}:${facilityExternalId}`;
}

export class RegistrySyncService {
  constructor(private readonly deps: Dependencies) {}

  async syncSnapshot(params: {
    snapshot: RegistrySnapshot;
    ingestionRunId: string;
  }): Promise<SyncStats> {
    const stats: SyncStats = {
      facilitiesCreated: 0,
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
    };

    const { snapshot, ingestionRunId } = params;
    const now = snapshot.fetchedAt;

    const facilityExternalToInternal = new Map<string, string>();
    const professionalExternalToInternal = new Map<string, string>();

    const sourceFacilityIds = new Set(snapshot.facilities.map((f) => f.externalSourceId));
    const sourceProfessionalIds = new Set(snapshot.doctors.map((d) => d.externalSourceId));
    const sourceAssociationKeys = new Set(
      snapshot.associations.map((a) =>
        associationKey(a.doctorExternalId, a.clinicExternalId)
      )
    );

    const diffStats = { fieldUpdateSuggestions: 0 };

    for (const facility of snapshot.facilities) {
      const existing = await this.deps.facilityRepository.findByExternalId(
        snapshot.provider,
        facility.externalSourceId
      );

      if (existing?.deletedAt) {
        await this.createSuggestionIfNew({
          type: "FACILITY_REGISTRY_REACTIVATED",
          ingestionRunId,
          facilityId: existing.id,
          reason: "reappeared_in_source",
          payload: { externalSourceId: facility.externalSourceId, name: facility.name },
          stats,
        });
        stats.facilitiesReactivationSuggestions += 1;
      }

      const result = await this.deps.facilityRepository.upsertFromSource({
        sourceProvider: snapshot.provider,
        externalSourceId: facility.externalSourceId,
        name: facility.name,
        address: facility.address,
        lat: facility.lat,
        lng: facility.lng,
        sourceContentHash: facility.contentHash,
        sourceLastSeenAt: now,
      });

      facilityExternalToInternal.set(facility.externalSourceId, result.facility.id);

      if (result.created) {
        stats.facilitiesCreated += 1;
      } else if (result.updated) {
        stats.facilitiesUpdated += 1;
      } else {
        stats.facilitiesUnchanged += 1;
      }

      if (!existing?.deletedAt) {
        await this.deps.registryDiffService.diffFacilityFromSource({
          facilityId: result.facility.id,
          source: facility,
          ingestionRunId,
          stats: diffStats,
        });

        await this.deps.suggestionRepository.supersedePending({
          type: "FACILITY_REGISTRY_DEACTIVATED",
          facilityId: result.facility.id,
        });
      }
    }

    stats.fieldUpdateSuggestions = diffStats.fieldUpdateSuggestions;
    stats.suggestionsCreated += diffStats.fieldUpdateSuggestions;

    const trackedFacilities = await this.deps.facilityRepository.findSourceTrackedByProvider(
      snapshot.provider
    );

    for (const facility of trackedFacilities) {
      if (!facility.externalSourceId || facility.deletedAt) {
        continue;
      }

      if (!sourceFacilityIds.has(facility.externalSourceId)) {
        await this.deps.facilityRepository.markSourceAbsent(facility.id, now);
        stats.facilitiesMarkedAbsent += 1;

        await this.createSuggestionIfNew({
          type: "FACILITY_REGISTRY_DEACTIVATED",
          ingestionRunId,
          facilityId: facility.id,
          reason: "missing_from_source",
          payload: {
            externalSourceId: facility.externalSourceId,
            name: facility.name,
          },
          stats,
        });
      }
    }

    for (const professional of snapshot.doctors) {
      const result = await this.deps.professionalRepository.upsertFromSource({
        sourceProvider: snapshot.provider,
        externalSourceId: professional.externalSourceId,
        firstName: professional.firstName,
        lastName: professional.lastName,
        specialty: professional.specialty,
        sourceContentHash: professional.contentHash,
        sourceLastSeenAt: now,
      });

      professionalExternalToInternal.set(professional.externalSourceId, result.professional.id);

      if (result.created) {
        stats.professionalsCreated += 1;
      } else if (result.updated) {
        stats.professionalsUpdated += 1;
      } else {
        stats.professionalsUnchanged += 1;
      }
    }

    const trackedProfessionals = await this.deps.professionalRepository.findSourceTrackedByProvider(
      snapshot.provider
    );

    for (const professional of trackedProfessionals) {
      if (!professional.externalSourceId) {
        continue;
      }

      if (!sourceProfessionalIds.has(professional.externalSourceId)) {
        await this.deps.professionalRepository.markSourceAbsent(professional.id, now);
        stats.professionalsMarkedAbsent += 1;
      }
    }

    for (const edge of snapshot.associations) {
      const professionalId = professionalExternalToInternal.get(edge.doctorExternalId);
      const facilityId = facilityExternalToInternal.get(edge.clinicExternalId);

      if (!professionalId || !facilityId) {
        continue;
      }

      const result = await this.deps.facilityProfessionalRepository.upsertSourceAssociation({
        professionalId,
        facilityId,
        sourceLastSeenAt: now,
      });

      if (result.created) {
        stats.associationsCreated += 1;
      } else {
        stats.associationsUpdated += 1;
      }

      await this.deps.suggestionRepository.supersedePending({
        type: "FACILITY_PROFESSIONAL_REMOVAL",
        facilityProfessionalId: result.association.id,
      });
    }

    const activeSourceAssociations =
      await this.deps.facilityProfessionalRepository.findActiveSourceAssociationsByProvider(
        snapshot.provider
      );

    for (const row of activeSourceAssociations) {
      const key = associationKey(
        row.professionalExternalSourceId,
        row.facilityExternalSourceId
      );

      if (sourceAssociationKeys.has(key)) {
        continue;
      }

      const updated = await this.deps.facilityProfessionalRepository.markSourceInactive({
        facilityProfessionalId: row.association.id,
        sourceLastSeenAt: now,
      });

      stats.associationsMarkedInactive += 1;

      await this.createSuggestionIfNew({
        type: "FACILITY_PROFESSIONAL_REMOVAL",
        ingestionRunId,
        facilityId: updated.facilityId,
        professionalId: updated.professionalId,
        facilityProfessionalId: updated.id,
        reason: "missing_from_source",
        payload: {
          confirmed: Boolean(updated.confirmedAt),
          professionalExternalSourceId: row.professionalExternalSourceId,
          facilityExternalSourceId: row.facilityExternalSourceId,
        },
        stats,
      });
    }

    return stats;
  }

  private async createSuggestionIfNew(params: {
    type: "FACILITY_REGISTRY_DEACTIVATED" | "FACILITY_REGISTRY_REACTIVATED" | "FACILITY_PROFESSIONAL_REMOVAL";
    ingestionRunId: string;
    facilityId?: string;
    professionalId?: string;
    facilityProfessionalId?: string;
    reason: string;
    payload: Record<string, unknown>;
    stats: SyncStats;
  }): Promise<void> {
    const duplicate = await this.deps.suggestionRepository.findPendingDuplicate({
      type: params.type,
      facilityId: params.facilityId,
      professionalId: params.professionalId,
      facilityProfessionalId: params.facilityProfessionalId,
    });

    if (duplicate) {
      return;
    }

    await this.deps.suggestionRepository.create({
      ingestionRunId: params.ingestionRunId,
      type: params.type,
      facilityId: params.facilityId,
      professionalId: params.professionalId,
      facilityProfessionalId: params.facilityProfessionalId,
      reason: params.reason,
      payload: params.payload,
    });

    params.stats.suggestionsCreated += 1;
  }
}
