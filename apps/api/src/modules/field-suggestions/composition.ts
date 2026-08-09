import { auditLogService } from "../../infrastructure/audit/audit-log.service";
import {
  facilityGeocodingService,
  facilityRepositories,
} from "../facility/composition";
import { territoryMembershipService } from "../territory/composition";
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

async function handleFacilityLocationChanged(facilityId: number): Promise<void> {
  await facilityGeocodingService.ensureCoordinatesPersisted(facilityId);
  await territoryMembershipService.assignFacilityById(facilityId);
}

const applyService = new FieldSuggestionApplyService({
  facilityRepository: facilityRepositories.facility,
  facilityGeocodingService,
  onFacilityLocationChanged: handleFacilityLocationChanged,
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
