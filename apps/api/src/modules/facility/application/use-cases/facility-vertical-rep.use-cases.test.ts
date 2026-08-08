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
