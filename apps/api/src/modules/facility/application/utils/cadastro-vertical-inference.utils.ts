import type { FacilityRepository } from "../interfaces/facility.repository.interface";
import { ValidationError } from "../../../../shared/errors";

/**
 * Cadastro vertical inference:
 * 1. Exactly one active facility profile → use it.
 * 2. Else exactly one user vertical with an active facility profile → use it.
 * 3. Else require explicit verticalId.
 */
export async function resolveCadastroVerticalId(input: {
  facilityId: number;
  assignedVerticalIds: number[];
  facilityRepository: FacilityRepository;
  verticalId?: number;
}): Promise<number> {
  const profilesByFacility = await input.facilityRepository.findVerticalProfilesByFacilityIds(
    [input.facilityId],
  );
  const activeProfiles = (profilesByFacility.get(input.facilityId) ?? []).filter(
    (profile) => profile.isActive,
  );

  if (activeProfiles.length === 1) {
    return activeProfiles[0]!.verticalId;
  }

  const userMatchingProfiles = activeProfiles.filter((profile) =>
    input.assignedVerticalIds.includes(profile.verticalId),
  );
  if (userMatchingProfiles.length === 1) {
    return userMatchingProfiles[0]!.verticalId;
  }

  if (input.verticalId) {
    return input.verticalId;
  }

  throw new ValidationError([
    { field: "verticalId", message: "verticalId is required when cadastro vertical is ambiguous" },
  ]);
}
