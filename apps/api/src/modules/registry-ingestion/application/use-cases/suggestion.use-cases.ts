import type { ScopeContext } from "@atlasmed/access";
import { assertResourceInScope } from "@atlasmed/access";
import type { IngestionSuggestionType } from "@atlasmed/database";
import {
  ForbiddenError,
  ValidationError,
} from "../../../../shared/errors";
import type { FacilityRepository } from "../../../facility/application/interfaces/facility.repository.interface";
import type { FacilityProfessionalRepository } from "../../../facility/application/interfaces/facility-professional.repository.interface";
import type { FacilityGeocodingService } from "../../../facility/application/services/facility-geocoding.service";
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
  facilityProfessionalRepository: FacilityProfessionalRepository;
  facilityGeocodingService?: FacilityGeocodingService;
  auditLogService?: AuditLogService;
}

function parseFieldUpdatePayload(payload: Record<string, unknown>): {
  name?: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
} {
  const changes = Array.isArray(payload.changes) ? payload.changes : [];
  const updates: {
    name?: string;
    address?: string | null;
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
    if (field === "address") {
      updates.address = typeof proposed === "string" ? proposed : null;
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

        if (updates.address !== undefined) {
          await this.deps.facilityGeocodingService?.ensureCoordinatesPersisted(
            suggestion.facilityId
          );
        }
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
