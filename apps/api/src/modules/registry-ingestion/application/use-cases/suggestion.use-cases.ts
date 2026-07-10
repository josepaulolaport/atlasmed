import type { ScopeContext } from "@atlasmed/access";
import { assertResourceInScope } from "@atlasmed/access";
import type { CnesSuggestionType as IngestionSuggestionType } from "@atlasmed/database";
import {
  ForbiddenError,
  ConfigurationError,
  ValidationError,
} from "../../../../shared/errors";
import type { FacilityRepository } from "../../../facility/application/interfaces/facility.repository.interface";
import type { FacilityProfessionalRepository } from "../../../facility/application/interfaces/facility-professional.repository.interface";
import type { FacilityRepresentativeRepository } from "../../../facility/application/interfaces/facility-representative.repository.interface";
import type { FacilityGeocodingService } from "../../../facility/application/services/facility-geocoding.service";
import type { ProfessionalRepository } from "../../../professional/application/interfaces/professional.repository.interface";
import type {
  IngestionSuggestionRecord,
  IngestionSuggestionRepository,
} from "../interfaces/ingestion.repository.interface";
import type { AuditLogService } from "../../../../infrastructure/audit/audit-log.service";

function assertSuggestionInScope(
  scope: ScopeContext,
  suggestion: IngestionSuggestionRecord
): void {
  if (scope.isGlobal) {
    return;
  }

  if (suggestion.facilityId) {
    assertResourceInScope(scope, "facility", suggestion.facilityId);
    return;
  }

  throw new ForbiddenError("Suggestion outside scope");
}

interface Dependencies {
  suggestionRepository: IngestionSuggestionRepository;
  facilityRepository: FacilityRepository;
  // Only required for suggestion types that mutate professionals / representatives.
  // Read/list/reject and facility-only approvals do not need them.
  professionalRepository?: ProfessionalRepository;
  facilityProfessionalRepository: FacilityProfessionalRepository;
  facilityRepresentativeRepository?: FacilityRepresentativeRepository;
  facilityGeocodingService?: FacilityGeocodingService;
  auditLogService?: AuditLogService;
}

function parseFieldUpdatePayload(payload: Record<string, unknown>): {
  name?: string;
  lat?: number | null;
  lng?: number | null;
} {
  const changes = Array.isArray(payload.changes) ? payload.changes : [];
  const updates: {
    name?: string;
    lat?: number | null;
    lng?: number | null;
  } = {};

  for (const change of changes) {
    if (!change || typeof change !== "object") {
      continue;
    }

    const field = (change as { field?: string }).field;
    const proposed = (change as { proposed?: unknown }).proposed;

    if (field === "displayName" && typeof proposed === "string") {
      updates.name = proposed;
    }
    if (field === "lat") {
      updates.lat = typeof proposed === "number" ? proposed : null;
    }
    if (field === "lng") {
      updates.lng = typeof proposed === "number" ? proposed : null;
    }
  }

  return updates;
}

function parseProfessionalFieldUpdatePayload(payload: Record<string, unknown>): {
  firstName?: string;
  lastName?: string;
  email?: string | null;
} {
  const changes = Array.isArray(payload.changes) ? payload.changes : [];
  const updates: {
    firstName?: string;
    lastName?: string;
    email?: string | null;
  } = {};

  for (const change of changes) {
    if (!change || typeof change !== "object") {
      continue;
    }

    const field = (change as { field?: string }).field;
    const proposed = (change as { proposed?: unknown }).proposed;

    if (field === "firstName" && typeof proposed === "string") {
      updates.firstName = proposed;
    }
    if (field === "lastName" && typeof proposed === "string") {
      updates.lastName = proposed;
    }
    if (field === "email") {
      updates.email = typeof proposed === "string" ? proposed : null;
    }
  }

  return updates;
}

function resolveSuggestionFacilityScope(
  scope: ScopeContext
): string[] | undefined {
  if (scope.isGlobal) {
    return undefined;
  }

  return scope.facilityIds.length > 0 ? scope.facilityIds : ["__none__"];
}

export class ListSuggestionsUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    scope: ScopeContext;
    page?: number;
    limit?: number;
    status?: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED" | "SUPERSEDED";
    type?: IngestionSuggestionType;
  }) {
    const page = input.page ?? 1;
    const limit = input.limit ?? 20;

    const { suggestions, total } = await this.deps.suggestionRepository.findAll({
      page,
      limit,
      status: input.status,
      type: input.type,
      facilityIds: resolveSuggestionFacilityScope(input.scope),
    });

    return {
      data: suggestions.map((s) => ({
        id: s.id,
        ingestionRunId: s.ingestionRunId,
        type: s.type,
        status: s.status,
        facilityId: s.facilityId ?? undefined,
        professionalId: s.professionalId ?? undefined,
        facilityProfessionalId: s.facilityProfessionalId ?? undefined,
        reason: s.reason ?? undefined,
        payload: s.payload,
        suggestedAt: s.suggestedAt.toISOString(),
        resolvedAt: s.resolvedAt?.toISOString(),
        resolvedByUserId: s.resolvedByUserId ?? undefined,
        resolutionNote: s.resolutionNote ?? undefined,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }
}

export class ApproveSuggestionUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    suggestionId: string;
    userId: string;
    scope: ScopeContext;
    resolutionNote?: string;
  }) {
    const suggestion = await this.deps.suggestionRepository.findById(
      input.suggestionId
    );

    if (!suggestion) {
      return null;
    }

    if (suggestion.status !== "PENDING") {
      throw new ValidationError([
        { field: "status", message: "Suggestion is not pending" },
      ]);
    }

    assertSuggestionInScope(input.scope, suggestion);

    switch (suggestion.type) {
      case "FACILITY_REGISTRY_DEACTIVATED": {
        if (!suggestion.facilityId) {
          throw new ValidationError([
            { field: "facilityId", message: "Facility removal suggestion missing facilityId" },
          ]);
        }
        await this.deps.facilityRepository.softDelete(suggestion.facilityId);
        break;
      }
      case "FACILITY_REGISTRY_REACTIVATED": {
        if (!suggestion.facilityId) {
          throw new ValidationError([
            {
              field: "facilityId",
              message: "Facility reactivation suggestion missing facilityId",
            },
          ]);
        }
        await this.deps.facilityRepository.reactivate(suggestion.facilityId);
        break;
      }
      case "FACILITY_PROFESSIONAL_REMOVAL":
      case "DOCTOR_CLINIC_REMOVAL": {
        if (!suggestion.facilityProfessionalId) {
          throw new ValidationError([
            {
              field: "facilityProfessionalId",
              message: "Professional removal suggestion missing facilityProfessionalId",
            },
          ]);
        }
        await this.deps.facilityProfessionalRepository.endAssociationById({
          facilityProfessionalId: suggestion.facilityProfessionalId,
          endedByUserId: input.userId,
          endReason: "suggestion_approved",
        });
        break;
      }
      case "FACILITY_FIELD_UPDATE": {
        if (!suggestion.facilityId) {
          throw new ValidationError([
            { field: "facilityId", message: "Field update suggestion missing facilityId" },
          ]);
        }

        const updates = parseFieldUpdatePayload(suggestion.payload);
        await this.deps.facilityRepository.applyApprovedFieldUpdates(
          suggestion.facilityId,
          updates
        );

        break;
      }
      case "PROFESSIONAL_FIELD_UPDATE": {
        if (!suggestion.professionalId) {
          throw new ValidationError([
            {
              field: "professionalId",
              message: "Professional field update suggestion missing professionalId",
            },
          ]);
        }

        if (!this.deps.professionalRepository) {
          throw new ConfigurationError("professionalRepository is required to approve professional field updates");
        }

        const updates = parseProfessionalFieldUpdatePayload(suggestion.payload);
        await this.deps.professionalRepository.update(suggestion.professionalId, updates);
        break;
      }
      case "FACILITY_PROFESSIONAL_ADD": {
        if (!suggestion.facilityId || !suggestion.professionalId) {
          throw new ValidationError([
            {
              field: "association",
              message: "Association add suggestion missing facilityId or professionalId",
            },
          ]);
        }

        await this.deps.facilityProfessionalRepository.upsertSourceAssociation({
          facilityId: suggestion.facilityId,
          professionalId: suggestion.professionalId,
          sourceLastSeenAt: new Date(),
        });
        break;
      }
      case "FACILITY_REPRESENTATIVE_ADD":
      case "FACILITY_REPRESENTATIVE_FIELD_UPDATE": {
        if (!this.deps.facilityRepresentativeRepository) {
          throw new ConfigurationError("facilityRepresentativeRepository is required to approve representative suggestions");
        }
        if (!suggestion.facilityId) {
          throw new ValidationError([
            { field: "facilityId", message: "Representative suggestion missing facilityId" },
          ]);
        }

        const payload = suggestion.payload;
        const externalSourceKey =
          typeof payload.externalSourceKey === "string" ? payload.externalSourceKey : null;
        const representativeName =
          typeof payload.representativeName === "string" ? payload.representativeName : null;

        if (!externalSourceKey || !representativeName) {
          throw new ValidationError([
            { field: "payload", message: "Representative suggestion missing registry payload" },
          ]);
        }

        await this.deps.facilityRepresentativeRepository.upsertFromRegistry({
          facilityId: suggestion.facilityId,
          externalSourceKey,
          representativeName,
          roleTitle:
            typeof payload.roleTitle === "string" ? payload.roleTitle : null,
          email: typeof payload.email === "string" ? payload.email : null,
          taxId: typeof payload.taxId === "string" ? payload.taxId : null,
        });
        break;
      }
      case "FACILITY_REPRESENTATIVE_REMOVAL": {
        if (!this.deps.facilityRepresentativeRepository) {
          throw new ConfigurationError("facilityRepresentativeRepository is required to approve representative suggestions");
        }
        if (!suggestion.facilityId) {
          throw new ValidationError([
            { field: "facilityId", message: "Representative removal suggestion missing facilityId" },
          ]);
        }

        const payload = suggestion.payload;
        const externalSourceKey =
          typeof payload.externalSourceKey === "string" ? payload.externalSourceKey : null;

        if (!externalSourceKey) {
          throw new ValidationError([
            { field: "payload", message: "Representative removal suggestion missing externalSourceKey" },
          ]);
        }

        await this.deps.facilityRepresentativeRepository.endSourceRepresentative({
          facilityId: suggestion.facilityId,
          externalSourceKey,
          endedByUserId: input.userId,
          endReason: "suggestion_approved",
        });
        break;
      }
    }

    const resolved = await this.deps.suggestionRepository.resolve({
      id: suggestion.id,
      status: "APPROVED",
      resolvedByUserId: input.userId,
      resolutionNote: input.resolutionNote,
    });

    await this.deps.auditLogService?.log({
      userId: input.userId,
      eventType: "REGISTRY_SUGGESTION_APPROVED",
      action: "registry_suggestion_approved",
      resource: "registry_suggestion",
      resourceId: resolved.id,
      details: { type: resolved.type, facilityId: resolved.facilityId, professionalId: resolved.professionalId },
    });

    return {
      id: resolved.id,
      status: resolved.status,
      type: resolved.type,
    };
  }
}

export class RejectSuggestionUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    suggestionId: string;
    userId: string;
    scope: ScopeContext;
    resolutionNote?: string;
  }) {
    const suggestion = await this.deps.suggestionRepository.findById(
      input.suggestionId
    );

    if (!suggestion) {
      return null;
    }

    if (suggestion.status !== "PENDING") {
      throw new ValidationError([
        { field: "status", message: "Suggestion is not pending" },
      ]);
    }

    assertSuggestionInScope(input.scope, suggestion);

    if (
      (suggestion.type === "FACILITY_PROFESSIONAL_REMOVAL" ||
        suggestion.type === "DOCTOR_CLINIC_REMOVAL") &&
      suggestion.facilityProfessionalId
    ) {
      await this.deps.facilityProfessionalRepository.restoreSourceActive(
        suggestion.facilityProfessionalId
      );
    }

    const resolved = await this.deps.suggestionRepository.resolve({
      id: suggestion.id,
      status: "REJECTED",
      resolvedByUserId: input.userId,
      resolutionNote: input.resolutionNote,
    });

    await this.deps.auditLogService?.log({
      userId: input.userId,
      eventType: "REGISTRY_SUGGESTION_REJECTED",
      action: "registry_suggestion_rejected",
      resource: "registry_suggestion",
      resourceId: resolved.id,
      details: { type: resolved.type, facilityId: resolved.facilityId, professionalId: resolved.professionalId },
    });

    return {
      id: resolved.id,
      status: resolved.status,
      type: resolved.type,
    };
  }
}

export class GetSuggestionUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: { suggestionId: string; scope: ScopeContext }) {
    const suggestion = await this.deps.suggestionRepository.findById(
      input.suggestionId
    );

    if (!suggestion) {
      return null;
    }

    assertSuggestionInScope(input.scope, suggestion);

    return {
      id: suggestion.id,
      ingestionRunId: suggestion.ingestionRunId,
      type: suggestion.type,
      status: suggestion.status,
      facilityId: suggestion.facilityId ?? undefined,
      professionalId: suggestion.professionalId ?? undefined,
      facilityProfessionalId: suggestion.facilityProfessionalId ?? undefined,
      reason: suggestion.reason ?? undefined,
      payload: suggestion.payload,
      suggestedAt: suggestion.suggestedAt.toISOString(),
    };
  }
}
