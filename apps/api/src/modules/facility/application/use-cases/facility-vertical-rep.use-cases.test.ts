import { describe, expect, it, mock } from "bun:test";
import type { ScopeContext } from "@atlasmed/access";
import { ForbiddenError, ValidationError } from "../../../../shared/errors";
import type {
  FacilityVerticalRepAssignmentRecord,
  FacilityVerticalRepAssignmentRepository,
} from "../interfaces/facility-vertical-rep-assignment.repository.interface";
import {
  AssignFacilityVerticalRepUseCase,
  DeactivateFacilityVerticalUseCase,
  UNASSIGN_REASONS,
  UnassignFacilityVerticalRepUseCase,
} from "./facility-vertical-rep.use-cases";

function scope(facilityIds: number[] = [1], verticalIds: number[] = [10]): ScopeContext {
  return {
    userId: 99,
    role: "MANAGER",
    facilityIds,
    territoryIds: [],
    assignedVerticalIds: verticalIds,
    verticalIds,
  } as unknown as ScopeContext;
}

function record(
  overrides: Partial<FacilityVerticalRepAssignmentRecord> = {},
): FacilityVerticalRepAssignmentRecord {
  return {
    id: 1,
    facilityVerticalProfileId: 5,
    facilityId: 1,
    verticalId: 10,
    userId: 7,
    startedAt: new Date("2026-01-01T00:00:00.000Z"),
    endedAt: null,
    assignedByUserId: 99,
    endReason: null,
    overrideReason: null,
    overrideByUserId: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function fakeRepo(
  impl: Partial<FacilityVerticalRepAssignmentRepository>,
): FacilityVerticalRepAssignmentRepository {
  return {
    findByFacilityVertical: async () => [],
    findCurrentByFacilityVertical: async () => null,
    findActiveFacilityIdsByUserId: async () => [],
    findOutOfTerritoryAssignments: async () => ({ rows: [], total: 0 }),
    assign: async () => ({
      assignment: record(),
      previousUserId: null,
      wasIdempotent: false,
    }),
    endActive: async () => ({ endedUserId: null }),
    endActiveForProfiles: async () => 0,
    deactivateVertical: async () => ({ profileId: null, endedUserId: null }),
    ...impl,
  };
}

describe("AssignFacilityVerticalRepUseCase", () => {
  it("assigns after vertical membership + cover checks", async () => {
    const assign = mock(async () => ({
      assignment: record({ userId: 7 }),
      previousUserId: 8,
      wasIdempotent: false,
    }));
    const onChanged = mock(async () => {});
    const onFacilityChanged = mock(async () => {});
    const uc = new AssignFacilityVerticalRepUseCase({
      repAssignmentRepository: fakeRepo({ assign }),
      assertVerticalActive: async () => {},
      assertAssigneeHasVertical: async () => {},
      assertAssigneeCoversFacility: async () => {},
      onRepAssignmentChanged: onChanged,
      onFacilityChanged,
    });

    const result = await uc.execute({
      facilityId: 1,
      verticalId: 10,
      userId: 7,
      assignedByUserId: 99,
      scope: scope(),
      role: "MANAGER",
    });

    expect(result.userId).toBe(7);
    expect(assign).toHaveBeenCalledTimes(1);
    expect(onChanged).toHaveBeenCalledWith([7, 8]);
    expect(onFacilityChanged).toHaveBeenCalledWith(1);
  });

  /**
   * Spec 0009 R2. I2 becomes "a patch covers the clinic **or** the assignment
   * carries an override". The informal market needs the second half; the record
   * is what makes it acceptable.
   */
  it("an override replaces the patch-coverage check and is recorded", async () => {
    const assign = mock(async () => ({
      assignment: record({ userId: 7, overrideReason: "Cliente histórico" }),
      previousUserId: null,
      wasIdempotent: false,
    }));
    const assertAssigneeCoversFacility = mock(async () => {
      throw new Error("coverage must not be consulted when an override is given");
    });

    const uc = new AssignFacilityVerticalRepUseCase({
      repAssignmentRepository: fakeRepo({ assign }),
      assertVerticalActive: async () => {},
      assertAssigneeHasVertical: async () => {},
      assertAssigneeCoversFacility,
      onRepAssignmentChanged: async () => {},
      onFacilityChanged: async () => {},
    });

    const result = await uc.execute({
      facilityId: 1,
      verticalId: 10,
      userId: 7,
      assignedByUserId: 99,
      scope: scope(),
      role: "MANAGER",
      overrideReason: "  Cliente histórico  ",
    });

    expect(assertAssigneeCoversFacility).not.toHaveBeenCalled();
    // Who overrode is the actor — R2 is about reportability, so the record has
    // to name someone, and it is whoever made the assignment.
    expect(assign).toHaveBeenCalledWith(
      expect.objectContaining({
        overrideReason: "Cliente histórico",
        overrideByUserId: 99,
      })
    );
    expect(result.overrideReason).toBe("Cliente histórico");
  });

  it("still enforces patch coverage when no override is given", async () => {
    const assertAssigneeCoversFacility = mock(async () => {
      throw new ValidationError([{ field: "userId", message: "not covered" }]);
    });
    const uc = new AssignFacilityVerticalRepUseCase({
      repAssignmentRepository: fakeRepo({}),
      assertVerticalActive: async () => {},
      assertAssigneeHasVertical: async () => {},
      assertAssigneeCoversFacility,
    });

    await expect(
      uc.execute({
        facilityId: 1,
        verticalId: 10,
        userId: 7,
        assignedByUserId: 99,
        scope: scope(),
        role: "MANAGER",
      })
    ).rejects.toBeInstanceOf(ValidationError);
    expect(assertAssigneeCoversFacility).toHaveBeenCalled();
  });

  it("refuses a blank override — an override must say why", async () => {
    const uc = new AssignFacilityVerticalRepUseCase({
      repAssignmentRepository: fakeRepo({}),
      assertVerticalActive: async () => {},
      assertAssigneeHasVertical: async () => {},
      assertAssigneeCoversFacility: async () => {},
    });

    await expect(
      uc.execute({
        facilityId: 1,
        verticalId: 10,
        userId: 7,
        assignedByUserId: 99,
        scope: scope(),
        role: "MANAGER",
        overrideReason: "   ",
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects assignee without vertical membership", async () => {
    const uc = new AssignFacilityVerticalRepUseCase({
      repAssignmentRepository: fakeRepo({}),
      assertVerticalActive: async () => {},
      assertAssigneeHasVertical: async () => {
        throw new ValidationError([
          {
            field: "userId",
            message: "assignee must have user_vertical_assignments for this vertical",
          },
        ]);
      },
    });

    await expect(
      uc.execute({
        facilityId: 1,
        verticalId: 10,
        userId: 7,
        assignedByUserId: 99,
        scope: scope(),
        role: "MANAGER",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects vertical outside actor scope", async () => {
    const uc = new AssignFacilityVerticalRepUseCase({
      repAssignmentRepository: fakeRepo({}),
      assertVerticalActive: async () => {},
      assertAssigneeHasVertical: async () => {},
    });

    await expect(
      uc.execute({
        facilityId: 1,
        verticalId: 99,
        userId: 7,
        assignedByUserId: 99,
        scope: scope([1], [10]),
        role: "MANAGER",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("UnassignFacilityVerticalRepUseCase", () => {
  it("is idempotent when no active assign", async () => {
    const onChanged = mock(async () => {});
    const uc = new UnassignFacilityVerticalRepUseCase({
      repAssignmentRepository: fakeRepo({
        endActive: async () => ({ endedUserId: null }),
      }),
      onRepAssignmentChanged: onChanged,
    });

    const result = await uc.execute({
      facilityId: 1,
      verticalId: 10,
      scope: scope(),
      role: "MANAGER",
    });

    expect(result.success).toBe(true);
    expect(result.userId).toBeUndefined();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("invalidates previous assignee when ended", async () => {
    const onChanged = mock(async () => {});
    const onFacilityChanged = mock(async () => {});
    const uc = new UnassignFacilityVerticalRepUseCase({
      repAssignmentRepository: fakeRepo({
        endActive: async () => ({ endedUserId: 7 }),
      }),
      onRepAssignmentChanged: onChanged,
      onFacilityChanged,
    });

    await uc.execute({
      facilityId: 1,
      verticalId: 10,
      scope: scope(),
      role: "MANAGER",
    });

    expect(onChanged).toHaveBeenCalledWith([7]);
    expect(onFacilityChanged).toHaveBeenCalledWith(1);
  });

  it("records why it ended and who ended it (spec 0015 R7)", async () => {
    const seen: Array<Record<string, unknown>> = [];
    const uc = new UnassignFacilityVerticalRepUseCase({
      repAssignmentRepository: fakeRepo({
        endActive: async (params: Record<string, unknown>) => {
          seen.push(params);
          return { endedUserId: 7 };
        },
      }),
    });

    await uc.execute({
      facilityId: 1,
      verticalId: 10,
      scope: scope(),
      role: "MANAGER",
      endReason: "clinic_closed",
      endedByUserId: 2,
    });

    // I5 keeps the row forever, so the row is the only account of what
    // happened. Without the author, a rep loses a clinic and the record says
    // only that someone, at some point, decided so.
    expect(seen[0]).toMatchObject({
      endReason: "clinic_closed",
      endedByUserId: 2,
    });
  });

  it("keeps the old catch-all when no reason is given", async () => {
    // Callers that predate the vocabulary still work, and their rows stay
    // honest about being unexplained rather than borrowing a reason.
    const seen: Array<Record<string, unknown>> = [];
    const uc = new UnassignFacilityVerticalRepUseCase({
      repAssignmentRepository: fakeRepo({
        endActive: async (params: Record<string, unknown>) => {
          seen.push(params);
          return { endedUserId: 7 };
        },
      }),
    });

    await uc.execute({
      facilityId: 1,
      verticalId: 10,
      scope: scope(),
      role: "MANAGER",
    });

    expect(seen[0]).toMatchObject({ endReason: "manual_unassign" });
  });

  it("offers no reason that belongs to the system", () => {
    // `reassigned`, `boundary_impact` and `vertical_deactivated` are things the
    // system did. Letting a person file a decision under one of those names
    // would make the churn report unreadable in the direction that matters.
    expect(UNASSIGN_REASONS).not.toContain("reassigned");
    expect(UNASSIGN_REASONS).not.toContain("boundary_impact");
    expect(UNASSIGN_REASONS).not.toContain("vertical_deactivated");
  });

  it("separates a chosen 'other' from a reason nobody recorded", () => {
    // The picker sent `manual_unassign` for "Outro motivo", which is also what
    // a legacy row and a caller sending nothing both carry. Counting how often
    // the four reasons fail to fit was therefore impossible.
    expect(UNASSIGN_REASONS).toContain("other");
    expect(UNASSIGN_REASONS).toContain("manual_unassign");
  });

  it("still defaults to the historical catch-all, not to 'other'", async () => {
    const seen: Array<{ endReason?: string }> = [];
    const endActive = mock(async (input: { endReason?: string }) => {
      seen.push(input);
      return { profileId: 1, endedUserId: 7 };
    });
    const uc = new UnassignFacilityVerticalRepUseCase({
      repAssignmentRepository: fakeRepo({ endActive }),
    });

    await uc.execute({
      facilityId: 1,
      verticalId: 10,
      scope: scope(),
      role: "MANAGER",
    });

    // A caller that says nothing has not chosen "other" — it has said nothing.
    expect(seen[0]).toMatchObject({ endReason: "manual_unassign" });
  });
});

describe("DeactivateFacilityVerticalUseCase", () => {
  it("ends assign and reports affected user", async () => {
    const deactivateVertical = mock(async () => ({
      profileId: 5,
      endedUserId: 7,
    }));
    const onChanged = mock(async () => {});
    const onFacilityChanged = mock(async () => {});
    const uc = new DeactivateFacilityVerticalUseCase({
      repAssignmentRepository: fakeRepo({ deactivateVertical }),
      onRepAssignmentChanged: onChanged,
      onFacilityChanged,
    });

    const result = await uc.execute({
      facilityId: 1,
      verticalId: 10,
      scope: scope(),
      role: "MANAGER",
    });

    expect(result.success).toBe(true);
    expect(deactivateVertical).toHaveBeenCalledWith({
      facilityId: 1,
      verticalId: 10,
    });
    expect(onChanged).toHaveBeenCalledWith([7]);
    expect(onFacilityChanged).toHaveBeenCalledWith(1);
  });
});
