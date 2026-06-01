import type { ScopeContext } from "@atlasmed/access";
import { assertResourceInScope } from "@atlasmed/access";
import {
  ForbiddenError,
  ValidationError,
} from "../../../../shared/errors";
import type { ClinicRepository } from "../../../clinic/application/interfaces/clinic.repository.interface";
import type { DoctorClinicAssociationRepository } from "../../../clinic/application/interfaces/doctor-clinic-association.repository.interface";
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

  if (suggestion.clinicId) {
    assertResourceInScope(scope, "clinic", suggestion.clinicId);
    return;
  }

  throw new ForbiddenError("Suggestion outside scope");
}

interface Dependencies {
  suggestionRepository: IngestionSuggestionRepository;
  clinicRepository: ClinicRepository;
  associationRepository: DoctorClinicAssociationRepository;
  auditLogService?: AuditLogService;
}

export class ListSuggestionsUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    scope: ScopeContext;
    page?: number;
    limit?: number;
    status?: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED" | "SUPERSEDED";
    type?: "CLINIC_REMOVAL" | "CLINIC_REACTIVATION" | "DOCTOR_CLINIC_REMOVAL";
  }) {
    const page = input.page ?? 1;
    const limit = input.limit ?? 20;

    const { suggestions, total } = await this.deps.suggestionRepository.findAll({
      page,
      limit,
      status: input.status,
      type: input.type,
      clinicIds: input.scope.isGlobal ? undefined : input.scope.clinicIds,
    });

    return {
      data: suggestions.map((s) => ({
        id: s.id,
        ingestionRunId: s.ingestionRunId,
        type: s.type,
        status: s.status,
        clinicId: s.clinicId ?? undefined,
        doctorId: s.doctorId ?? undefined,
        associationId: s.associationId ?? undefined,
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
      case "CLINIC_REMOVAL": {
        if (!suggestion.clinicId) {
          throw new ValidationError([
            { field: "clinicId", message: "Clinic removal suggestion missing clinicId" },
          ]);
        }
        await this.deps.clinicRepository.softDelete(suggestion.clinicId);
        break;
      }
      case "CLINIC_REACTIVATION": {
        if (!suggestion.clinicId) {
          throw new ValidationError([
            {
              field: "clinicId",
              message: "Clinic reactivation suggestion missing clinicId",
            },
          ]);
        }
        await this.deps.clinicRepository.reactivate(suggestion.clinicId);
        break;
      }
      case "DOCTOR_CLINIC_REMOVAL": {
        if (!suggestion.associationId) {
          throw new ValidationError([
            {
              field: "associationId",
              message: "Doctor-clinic removal suggestion missing associationId",
            },
          ]);
        }
        await this.deps.associationRepository.endAssociationById({
          associationId: suggestion.associationId,
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
      details: { type: resolved.type, clinicId: resolved.clinicId, doctorId: resolved.doctorId },
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
      suggestion.type === "DOCTOR_CLINIC_REMOVAL" &&
      suggestion.associationId
    ) {
      await this.deps.associationRepository.restoreSourceActive(
        suggestion.associationId
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
      details: { type: resolved.type, clinicId: resolved.clinicId, doctorId: resolved.doctorId },
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
      clinicId: suggestion.clinicId ?? undefined,
      doctorId: suggestion.doctorId ?? undefined,
      associationId: suggestion.associationId ?? undefined,
      reason: suggestion.reason ?? undefined,
      payload: suggestion.payload,
      suggestedAt: suggestion.suggestedAt.toISOString(),
    };
  }
}
