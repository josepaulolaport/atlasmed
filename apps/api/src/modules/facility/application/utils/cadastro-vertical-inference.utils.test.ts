import { describe, expect, it, mock } from "bun:test";
import type { FacilityRepository } from "../interfaces/facility.repository.interface";
import { resolveCadastroVerticalId } from "./cadastro-vertical-inference.utils";
import { ForbiddenError, ValidationError } from "../../../../shared/errors";

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

  // Spec 0010 §2.1/§2.2 — the vertical parameter is a filter, never a grant.
  it("rejects an explicit verticalId outside the caller's assignments", async () => {
    await expect(
      resolveCadastroVerticalId({
        facilityId: 1,
        assignedVerticalIds: [1],
        facilityRepository: repoWithProfiles([
          { verticalId: 1, isActive: true },
          { verticalId: 2, isActive: true },
        ]),
        verticalId: 2,
      })
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("rejects a single active profile the caller is not assigned to", async () => {
    await expect(
      resolveCadastroVerticalId({
        facilityId: 1,
        assignedVerticalIds: [2],
        facilityRepository: repoWithProfiles([{ verticalId: 1, isActive: true }]),
      })
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("does not narrow global (ADMIN) scope", async () => {
    const verticalId = await resolveCadastroVerticalId({
      facilityId: 1,
      assignedVerticalIds: [],
      isGlobal: true,
      facilityRepository: repoWithProfiles([{ verticalId: 1, isActive: true }]),
    });
    expect(verticalId).toBe(1);
  });

  it("accepts an explicit verticalId that is assigned", async () => {
    const verticalId = await resolveCadastroVerticalId({
      facilityId: 1,
      assignedVerticalIds: [1, 2],
      facilityRepository: repoWithProfiles([
        { verticalId: 1, isActive: true },
        { verticalId: 2, isActive: true },
      ]),
      verticalId: 1,
    });
    expect(verticalId).toBe(1);
  });
});
