import type { FacilityRepository } from "../../../facility/application/interfaces/facility.repository.interface";
import type {
  IngestionSuggestionRepository,
} from "../interfaces/ingestion.repository.interface";
import type { SanitizedFacilityRecord } from "../interfaces/registry-source.port";
import type { IngestionSuggestionType } from "@atlasmed/database";

export interface DiffStats {
  fieldUpdateSuggestions: number;
}

interface FieldChange {
  field: string;
  current: unknown;
  proposed: unknown;
}

function valuesDiffer(current: unknown, proposed: unknown): boolean {
  const normalizedCurrent = current === undefined ? null : current;
  const normalizedProposed = proposed === undefined ? null : proposed;
  return normalizedCurrent !== normalizedProposed;
}

function detectFacilityFieldChanges(
  facility: {
    name: string;
    address: string | null;
    lat: number | null;
    lng: number | null;
  },
  source: SanitizedFacilityRecord
): FieldChange[] {
  const changes: FieldChange[] = [];

  if (valuesDiffer(facility.name, source.name)) {
    changes.push({ field: "displayName", current: facility.name, proposed: source.name });
  }
  if (valuesDiffer(facility.address, source.address)) {
    changes.push({ field: "address", current: facility.address, proposed: source.address });
  }
  if (valuesDiffer(facility.lat, source.lat)) {
    changes.push({ field: "lat", current: facility.lat, proposed: source.lat });
  }
  if (valuesDiffer(facility.lng, source.lng)) {
    changes.push({ field: "lng", current: facility.lng, proposed: source.lng });
  }

  return changes;
}

interface Dependencies {
  facilityRepository: FacilityRepository;
  suggestionRepository: IngestionSuggestionRepository;
}

export class RegistryDiffService {
  constructor(private readonly deps: Dependencies) {}

  async diffFacilityFromSource(params: {
    facilityId: string;
    source: SanitizedFacilityRecord;
    ingestionRunId: string;
    stats: DiffStats;
  }): Promise<void> {
    const facility = await this.deps.facilityRepository.findById(params.facilityId);
    if (!facility) {
      return;
    }

    const changes = detectFacilityFieldChanges(facility, params.source);
    if (changes.length === 0) {
      return;
    }

    await this.createSuggestionIfNew({
      type: "FACILITY_FIELD_UPDATE",
      ingestionRunId: params.ingestionRunId,
      facilityId: params.facilityId,
      reason: "registry_field_mismatch",
      payload: {
        externalSourceId: params.source.externalSourceId,
        changes,
      },
      stats: params.stats,
    });
  }

  private async createSuggestionIfNew(params: {
    type: IngestionSuggestionType;
    ingestionRunId: string;
    facilityId?: string;
    professionalId?: string;
    facilityProfessionalId?: string;
    reason: string;
    payload: Record<string, unknown>;
    stats: DiffStats;
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

    if (params.type === "FACILITY_FIELD_UPDATE") {
      params.stats.fieldUpdateSuggestions += 1;
    }
  }
}
