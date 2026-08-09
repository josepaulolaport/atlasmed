import { describe, expect, it, mock } from "bun:test";
import type { FacilityRepository } from "../interfaces/facility.repository.interface";
import { resolveCadastroVerticalId } from "./cadastro-vertical-inference.utils";
import { ValidationError } from "../../../../shared/errors";

function repoWithProfiles(
  profiles: Array<{ verticalId: number; isActive: boolean }>
): FacilityRepository {
  return {
    findVerticalProfilesByFacilityIds: mock(async () =>
      new Map([[1, profiles.map((p) => ({ ...p, commercialStatus: null, purchaseStatus: null }))]])
    ),
  } as unknown as FacilityRepository;
}

describe("resolveCadastroVerticalId", () => {
  it("uses the single active facility profile", async () => {
    const verticalId = await resolveCadastroVerticalId({
      facilityId: 1,
      assignedVerticalIds: [1, 2],
      facilityRepository: repoWithProfiles([{ verticalId: 1, isActive: true }]),
    });
    expect(verticalId).toBe(1);
  });

  it("uses the single user vertical that matches a facility profile", async () => {
    const verticalId = await resolveCadastroVerticalId({
      facilityId: 1,
      assignedVerticalIds: [2],
      facilityRepository: repoWithProfiles([
        { verticalId: 1, isActive: true },
        { verticalId: 2, isActive: true },
      ]),
    });
    expect(verticalId).toBe(2);
  });

  it("requires explicit verticalId when both sides are ambiguous", async () => {
    await expect(
      resolveCadastroVerticalId({
        facilityId: 1,
        assignedVerticalIds: [1, 2],
        facilityRepository: repoWithProfiles([
          { verticalId: 1, isActive: true },
          { verticalId: 2, isActive: true },
        ]),
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("accepts explicit verticalId when ambiguous", async () => {
    const verticalId = await resolveCadastroVerticalId({
      facilityId: 1,
      assignedVerticalIds: [1, 2],
      facilityRepository: repoWithProfiles([
        { verticalId: 1, isActive: true },
        { verticalId: 2, isActive: true },
      ]),
      verticalId: 2,
    });
    expect(verticalId).toBe(2);
  });
});
