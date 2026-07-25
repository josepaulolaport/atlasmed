import { describe, expect, it, mock } from "bun:test";
import type { FacilityRepository } from "../interfaces/facility.repository.interface";
import { resolveCadastroVerticalId } from "./cadastro-vertical-inference.utils";
import { ValidationError } from "../../../../shared/errors";

function repoWithProfiles(
  profiles: Array<{ verticalId: string; isActive: boolean }>
): FacilityRepository {
  return {
    findVerticalProfilesByFacilityIds: mock(async () =>
      new Map([["facility-1", profiles.map((p) => ({ ...p, commercialStatus: null, purchaseStatus: null }))]])
    ),
  } as unknown as FacilityRepository;
}

describe("resolveCadastroVerticalId", () => {
  it("uses the single active facility profile", async () => {
    const verticalId = await resolveCadastroVerticalId({
      facilityId: "facility-1",
      assignedVerticalIds: ["v1", "v2"],
      facilityRepository: repoWithProfiles([{ verticalId: "v1", isActive: true }]),
    });
    expect(verticalId).toBe("v1");
  });

  it("uses the single user vertical that matches a facility profile", async () => {
    const verticalId = await resolveCadastroVerticalId({
      facilityId: "facility-1",
      assignedVerticalIds: ["v2"],
      facilityRepository: repoWithProfiles([
        { verticalId: "v1", isActive: true },
        { verticalId: "v2", isActive: true },
      ]),
    });
    expect(verticalId).toBe("v2");
  });

  it("requires explicit verticalId when both sides are ambiguous", async () => {
    await expect(
      resolveCadastroVerticalId({
        facilityId: "facility-1",
        assignedVerticalIds: ["v1", "v2"],
        facilityRepository: repoWithProfiles([
          { verticalId: "v1", isActive: true },
          { verticalId: "v2", isActive: true },
        ]),
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("accepts explicit verticalId when ambiguous", async () => {
    const verticalId = await resolveCadastroVerticalId({
      facilityId: "facility-1",
      assignedVerticalIds: ["v1", "v2"],
      facilityRepository: repoWithProfiles([
        { verticalId: "v1", isActive: true },
        { verticalId: "v2", isActive: true },
      ]),
      verticalId: "v2",
    });
    expect(verticalId).toBe("v2");
  });
});
