import type { ScopeContext } from "@atlasmed/access";
import { assertResourceInScope } from "@atlasmed/access";
import type { FieldSuggestionStatus } from "@atlasmed/database";
import {
  OperationNotAllowedError,
  ValidationError,
} from "../../../../shared/errors";
import type { FacilityRepository } from "../../../facility/application/interfaces/facility.repository.interface";
import type { AuditLogService } from "../../../../infrastructure/audit/audit-log.service";
import {
  isFieldSuggestionFieldKey,
  snapshotCurrentValue,
} from "../constants/field-keys";
import type { FieldSuggestionRepository } from "../interfaces/field-suggestion.repository.interface";
import { serializeFieldSuggestion } from "../mappers/field-suggestion.mapper";
import type { FieldSuggestionApplyService } from "../services/field-suggestion-apply.service";

function resolveFacilityScope(scope: ScopeContext): number[] | undefined {
  if (scope.isGlobal) {
    return undefined;
  }
  return scope.facilityIds.length > 0 ? scope.facilityIds : [];
}

interface Dependencies {
  fieldSuggestionRepository: FieldSuggestionRepository;
  facilityRepository: FacilityRepository;
  applyService: FieldSuggestionApplyService;
  /** Re-syncs the facility's search document; deletes it once deactivated. */
  onFacilityChanged?: (facilityId: number) => Promise<void>;
  auditLogService?: AuditLogService;
}

export class CreateFacilityFieldSuggestionUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    facilityId: number;
    userId: number;
    scope: ScopeContext;
    kind: "FIELD_CHANGE" | "DEACTIVATION";
    fieldKey?: string;
    proposedValue?: unknown;
    reason?: string | null;
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);

    const facility = await this.deps.facilityRepository.findById(input.facilityId);
    if (!facility || facility.deactivatedAt) {
      return null;
    }

    if (input.kind === "DEACTIVATION") {
      const { suggestion, supersededIds } =
        await this.deps.fieldSuggestionRepository.createWithSupersede({
          kind: "DEACTIVATION",
          facilityId: input.facilityId,
          fieldKey: null,
          currentValue: { deactivatedAt: facility.deactivatedAt },
          proposedValue: { deactivate: true },
          reason: input.reason ?? null,
          submittedByUserId: input.userId,
        });

      await this.deps.auditLogService?.log({
        userId: input.userId,
        eventType: "FIELD_SUGGESTION.CREATED",
        action: "field_suggestion_created",
        resource: "field_suggestion",
        resourceId: String(suggestion.id),
        details: { kind: "DEACTIVATION", facilityId: input.facilityId, supersededIds },
      });

      for (const supersededId of supersededIds) {
        await this.deps.auditLogService?.log({
          userId: input.userId,
          eventType: "FIELD_SUGGESTION.SUPERSEDED",
          action: "field_suggestion_superseded",
          resource: "field_suggestion",
          resourceId: String(supersededId),
          details: { supersededBy: suggestion.id },
        });
      }

      return serializeFieldSuggestion(suggestion);
    }

    if (!input.fieldKey || !isFieldSuggestionFieldKey(input.fieldKey)) {
      throw new ValidationError([
        { field: "fieldKey", message: "Unknown or missing administrative field key" },
      ]);
    }

    const fieldKey = input.fieldKey;
    const proposedValue = this.deps.applyService.validateProposedValue(
      fieldKey,
      input.proposedValue
    );
    const currentValue = snapshotCurrentValue(facility, fieldKey);

    const { suggestion, supersededIds } =
      await this.deps.fieldSuggestionRepository.createWithSupersede({
        kind: "FIELD_CHANGE",
        facilityId: input.facilityId,
        fieldKey,
        currentValue,
        proposedValue,
        reason: input.reason ?? null,
        submittedByUserId: input.userId,
      });

    await this.deps.auditLogService?.log({
      userId: input.userId,
      eventType: "FIELD_SUGGESTION.CREATED",
      action: "field_suggestion_created",
      resource: "field_suggestion",
      resourceId: String(suggestion.id),
      details: { kind: "FIELD_CHANGE", fieldKey, facilityId: input.facilityId, supersededIds },
    });

    for (const supersededId of supersededIds) {
      await this.deps.auditLogService?.log({
        userId: input.userId,
        eventType: "FIELD_SUGGESTION.SUPERSEDED",
        action: "field_suggestion_superseded",
        resource: "field_suggestion",
        resourceId: String(supersededId),
        details: { supersededBy: suggestion.id },
      });
    }

    return serializeFieldSuggestion(suggestion);
  }
}

export class ListFieldSuggestionsUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    scope: ScopeContext;
    page?: number;
    limit?: number;
    status?: FieldSuggestionStatus;
    facilityId?: number;
    submittedByUserId?: number;
    mineOnly?: boolean;
    userId: number;
  }) {
    const page = input.page ?? 1;
    const limit = input.limit ?? 20;

    if (input.facilityId) {
      assertResourceInScope(input.scope, "facility", input.facilityId);
    }

    const facilityIds = input.facilityId
      ? undefined
      : resolveFacilityScope(input.scope);

    const { suggestions, total } = await this.deps.fieldSuggestionRepository.findAll({
      page,
      limit,
      status: input.status,
      facilityId: input.facilityId,
      facilityIds,
      submittedByUserId: input.mineOnly ? input.userId : input.submittedByUserId,
    });

    return {
      data: suggestions.map(serializeFieldSuggestion),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }
}

export class GetFieldSuggestionUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: { suggestionId: number; scope: ScopeContext }) {
    const suggestion = await this.deps.fieldSuggestionRepository.findById(
      input.suggestionId
    );
    if (!suggestion) {
      return null;
    }

    assertResourceInScope(input.scope, "facility", suggestion.facilityId);
    return serializeFieldSuggestion(suggestion);
  }
}

export class ApproveFieldSuggestionUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    suggestionId: number;
    userId: number;
    scope: ScopeContext;
    resolutionNote?: string;
    /**
     * Spec 0009 R5: approving a location change that would strand a rep needs
     * the reviewer to say so. Without it the approval is refused with the list
     * of affected assignments, and nothing is written.
     */
    acceptCoverageLoss?: boolean;
  }) {
    const suggestion = await this.deps.fieldSuggestionRepository.findById(
      input.suggestionId
    );
    if (!suggestion) {
      return null;
    }

    if (suggestion.status !== "PENDING") {
      throw new OperationNotAllowedError(
        "approve_field_suggestion",
        "Suggestion is not pending"
      );
    }

    assertResourceInScope(input.scope, "facility", suggestion.facilityId);

    let geocoded = false;

    if (suggestion.kind === "DEACTIVATION") {
      await this.deps.facilityRepository.softDelete(suggestion.facilityId);
      // The search index is the only place a deactivated clinic could still be
      // seen: Meilisearch backs Explorar's list and map, and nothing else here
      // told it the row was gone. `DELETE /facilities/:id` has always done this;
      // this path — the only one a reviewer actually uses — did not.
      await this.deps.onFacilityChanged?.(suggestion.facilityId);
    } else {
      if (!suggestion.fieldKey || !isFieldSuggestionFieldKey(suggestion.fieldKey)) {
        throw new ValidationError([
          { field: "fieldKey", message: "Invalid field key on suggestion" },
        ]);
      }

      // Applied before the suggestion is marked APPROVED: a refused coverage
      // loss must leave the suggestion PENDING, so the reviewer can come back to
      // it rather than find it approved with nothing applied.
      const result = await this.deps.applyService.applyFieldChange({
        facilityId: suggestion.facilityId,
        fieldKey: suggestion.fieldKey,
        proposedValue: suggestion.proposedValue,
        acceptCoverageLoss: input.acceptCoverageLoss,
      });
      geocoded = result.geocoded;
    }

    const resolved = await this.deps.fieldSuggestionRepository.resolve(suggestion.id, {
      status: "APPROVED",
      resolvedByUserId: input.userId,
      resolutionNote: input.resolutionNote,
    });

    if (!resolved) {
      return null;
    }

    await this.deps.auditLogService?.log({
      userId: input.userId,
      eventType: "FIELD_SUGGESTION.APPROVED",
      action: "field_suggestion_approved",
      resource: "field_suggestion",
      resourceId: String(resolved.id),
      details: {
        facilityId: resolved.facilityId,
        kind: resolved.kind,
        fieldKey: resolved.fieldKey,
        geocoded,
      },
    });

    return serializeFieldSuggestion(resolved);
  }
}

export class RejectFieldSuggestionUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    suggestionId: number;
    userId: number;
    scope: ScopeContext;
    resolutionNote?: string;
  }) {
    const suggestion = await this.deps.fieldSuggestionRepository.findById(
      input.suggestionId
    );
    if (!suggestion) {
      return null;
    }

    if (suggestion.status !== "PENDING") {
      throw new OperationNotAllowedError(
        "reject_field_suggestion",
        "Suggestion is not pending"
      );
    }

    assertResourceInScope(input.scope, "facility", suggestion.facilityId);

    const resolved = await this.deps.fieldSuggestionRepository.resolve(suggestion.id, {
      status: "REJECTED",
      resolvedByUserId: input.userId,
      resolutionNote: input.resolutionNote,
    });

    if (!resolved) {
      return null;
    }

    await this.deps.auditLogService?.log({
      userId: input.userId,
      eventType: "FIELD_SUGGESTION.REJECTED",
      action: "field_suggestion_rejected",
      resource: "field_suggestion",
      resourceId: String(resolved.id),
      details: { facilityId: resolved.facilityId, kind: resolved.kind },
    });

    return serializeFieldSuggestion(resolved);
  }
}
