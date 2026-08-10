import { resolveAccessibleVerticalIds } from "@atlasmed/access";
import type { FacilityRepository } from "../interfaces/facility.repository.interface";
import { ForbiddenError, ValidationError } from "../../../../shared/errors";

/**
 * Cadastro vertical inference.
 *
 * Spec 0010 §2.1 — the vertical parameter is a filter, never a grant. An explicit
 * `verticalId` must be a subset of the caller's assigned verticals, and inference
 * only ever considers profiles the caller may actually operate in.
 *
 * 1. Explicit `verticalId` → must be ⊆ assigned; used as-is.
 * 2. Exactly one *accessible* active facility profile → use it.
 * 3. Else require an explicit `verticalId`.
 *
 * Global scope (ADMIN) is not narrowed — spec 0010 §2.3 defers ADMIN vertical
 * scoping, and a global scope carries an empty `assignedVerticalIds`.
 */
export async function resolveCadastroVerticalId(input: {
  facilityId: number;
  assignedVerticalIds: number[];
  /** Global scope (ADMIN) bypasses vertical narrowing — spec 0010 §2.3. */
  isGlobal?: boolean;
  facilityRepository: FacilityRepository;
  verticalId?: number;
}): Promise<number> {
  const isGlobal = input.isGlobal ?? false;

  if (input.verticalId && !isGlobal) {
    const allowed = resolveAccessibleVerticalIds({
      assignedVerticalIds: input.assignedVerticalIds,
      filterVerticalId: input.verticalId,
    });
    if (!allowed.ok) {
      throw new ForbiddenError("Vertical outside assignment");
    }
  }

  const profilesByFacility = await input.facilityRepository.findVerticalProfilesByFacilityIds(
    [input.facilityId],
  );
  const activeProfiles = (profilesByFacility.get(input.facilityId) ?? []).filter(
    (profile) => profile.isActive,
  );

  const accessibleProfiles = isGlobal
    ? activeProfiles
    : activeProfiles.filter((profile) =>
        input.assignedVerticalIds.includes(profile.verticalId),
      );

  if (accessibleProfiles.length === 1) {
    return accessibleProfiles[0]!.verticalId;
  }

  if (input.verticalId) {
    return input.verticalId;
  }

  if (activeProfiles.length > 0 && accessibleProfiles.length === 0) {
    throw new ForbiddenError("Vertical outside assignment");
  }

  throw new ValidationError([
    { field: "verticalId", message: "verticalId is required when cadastro vertical is ambiguous" },
  ]);
}
