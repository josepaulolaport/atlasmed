import { auditLogService } from "../../infrastructure/audit/audit-log.service";
import {
  facilityLocationService,
  facilityRepositories,
} from "../facility/composition";
import { FieldSuggestionApplyService } from "./application/services/field-suggestion-apply.service";
import {
  ApproveFieldSuggestionUseCase,
  CreateFacilityFieldSuggestionUseCase,
  GetFieldSuggestionUseCase,
  ListFieldSuggestionsUseCase,
  RejectFieldSuggestionUseCase,
} from "./application/use-cases/field-suggestion.use-cases";
import { DrizzleFieldSuggestionRepository } from "./infrastructure/repositories/drizzle/drizzle-field-suggestion.repository";

const fieldSuggestionRepository = new DrizzleFieldSuggestionRepository();

// Spec 0009 R5: approvals write locations through the one service that owns
// them, so geocoding, the coverage delta and the membership recompute happen
// here for the same reasons they happen everywhere else.
const applyService = new FieldSuggestionApplyService({
  facilityRepository: facilityRepositories.facility,
  locationService: facilityLocationService,
});

const deps = {
  fieldSuggestionRepository,
  facilityRepository: facilityRepositories.facility,
  applyService,
  auditLogService,
};

export const fieldSuggestionUseCases = {
  createFacilityFieldSuggestion: () =>
    new CreateFacilityFieldSuggestionUseCase(deps),
  listFieldSuggestions: () => new ListFieldSuggestionsUseCase(deps),
  getFieldSuggestion: () => new GetFieldSuggestionUseCase(deps),
  approveFieldSuggestion: () => new ApproveFieldSuggestionUseCase(deps),
  rejectFieldSuggestion: () => new RejectFieldSuggestionUseCase(deps),
};
