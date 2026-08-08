import type { ScopeContext } from "@atlasmed/access";
import { assertResourceInScope } from "@atlasmed/access";
import { ValidationError } from "../../../../shared/errors";
import type { FacilityVerticalRepAssignmentRepository } from "../interfaces/facility-vertical-rep-assignment.repository.interface";
import { resolveVerticalIds } from "../../../access/application/services/vertical-access.service";

function assertActorVerticalInScope(input: {
  role: string;
  scope: ScopeContext;
  verticalId: number;
}): void {
  const resolvedVerticalIds = resolveVerticalIds({
    role: input.role,
    assignedVerticalIds: input.scope.assignedVerticalIds ?? [],
    queryVerticalId: input.verticalId,
  });
  if (!resolvedVerticalIds.includes(input.verticalId)) {
    throw new ValidationError([
      {
        field: "verticalId",
        message: "verticalId is outside actor vertical scope",
      },
    ]);
  }
}

export class ListFacilityVerticalRepAssignmentsUseCase {
  constructor(
    private readonly deps: {
      repAssignmentRepository: FacilityVerticalRepAssignmentRepository;
    },
  ) {}

  async execute(input: {
    facilityId: number;
    verticalId: number;
    scope: ScopeContext;
    role: string;
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);
    assertActorVerticalInScope(input);

    const assignments =
      await this.deps.repAssignmentRepository.findByFacilityVertical(
        input.facilityId,
        input.verticalId,
      );

    return {
      data: assignments.map((assignment) => ({
        id: assignment.id,
        facilityId: assignment.facilityId,
        verticalId: assignment.verticalId,
        facilityVerticalProfileId: assignment.facilityVerticalProfileId,
        userId: assignment.userId,
        startedAt: assignment.startedAt.toISOString(),
        endedAt: assignment.endedAt?.toISOString(),
        assignedByUserId: assignment.assignedByUserId ?? undefined,
        endReason: assignment.endReason ?? undefined,
        isCurrent: assignment.endedAt === null,
      })),
    };
  }
}

export class AssignFacilityVerticalRepUseCase {
  constructor(
    private readonly deps: {
      repAssignmentRepository: FacilityVerticalRepAssignmentRepository;
      assertVerticalActive: (verticalId: number) => Promise<void>;
      assertAssigneeHasVertical: (input: {
        userId: number;
        verticalId: number;
      }) => Promise<void>;
      /** Spec 0006 restricted assign: assignee must cover clinic with a rep patch. */
      assertAssigneeCoversFacility?: (input: {
        userId: number;
        facilityId: number;
      }) => Promise<void>;
      onRepAssignmentChanged?: (userIds: number[]) => Promise<void>;
      /** Keep Meili `repUserIds` fresh after assign/reassign. */
      onFacilityChanged?: (facilityId: number) => Promise<void>;
    },
  ) {}

  async execute(input: {
    facilityId: number;
    verticalId: number;
    userId: number;
    assignedByUserId: number;
    scope: ScopeContext;
    role: string;
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);
    assertActorVerticalInScope(input);

    await this.deps.assertVerticalActive(input.verticalId);
    await this.deps.assertAssigneeHasVertical({
      userId: input.userId,
      verticalId: input.verticalId,
    });
    await this.deps.assertAssigneeCoversFacility?.({
      userId: input.userId,
      facilityId: input.facilityId,
    });

    const { assignment, previousUserId } =
      await this.deps.repAssignmentRepository.assign({
        facilityId: input.facilityId,
        verticalId: input.verticalId,
        userId: input.userId,
        assignedByUserId: input.assignedByUserId,
      });

    const affectedUserIds = [
      input.userId,
      ...(previousUserId && previousUserId !== input.userId
        ? [previousUserId]
        : []),
    ];
    await this.deps.onRepAssignmentChanged?.(affectedUserIds);
    await this.deps.onFacilityChanged?.(input.facilityId);

    return {
      id: assignment.id,
      facilityId: assignment.facilityId,
      verticalId: assignment.verticalId,
      facilityVerticalProfileId: assignment.facilityVerticalProfileId,
      userId: assignment.userId,
      startedAt: assignment.startedAt.toISOString(),
      assignedByUserId: assignment.assignedByUserId ?? undefined,
    };
  }
}

export class UnassignFacilityVerticalRepUseCase {
  constructor(
    private readonly deps: {
      repAssignmentRepository: FacilityVerticalRepAssignmentRepository;
      onRepAssignmentChanged?: (userIds: number[]) => Promise<void>;
      onFacilityChanged?: (facilityId: number) => Promise<void>;
    },
  ) {}

  async execute(input: {
    facilityId: number;
    verticalId: number;
    scope: ScopeContext;
    role: string;
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);
    assertActorVerticalInScope(input);

    const { endedUserId } = await this.deps.repAssignmentRepository.endActive({
      facilityId: input.facilityId,
      verticalId: input.verticalId,
      endReason: "manual_unassign",
    });

    if (endedUserId != null) {
      await this.deps.onRepAssignmentChanged?.([endedUserId]);
      await this.deps.onFacilityChanged?.(input.facilityId);
    }

    return {
      success: true as const,
      facilityId: input.facilityId,
      verticalId: input.verticalId,
      userId: endedUserId ?? undefined,
    };
  }
}

export class DeactivateFacilityVerticalUseCase {
  constructor(
    private readonly deps: {
      repAssignmentRepository: FacilityVerticalRepAssignmentRepository;
      onRepAssignmentChanged?: (userIds: number[]) => Promise<void>;
      onFacilityChanged?: (facilityId: number) => Promise<void>;
    },
  ) {}

  async execute(input: {
    facilityId: number;
    verticalId: number;
    scope: ScopeContext;
    role: string;
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);
    assertActorVerticalInScope(input);

    const { endedUserId } =
      await this.deps.repAssignmentRepository.deactivateVertical({
        facilityId: input.facilityId,
        verticalId: input.verticalId,
      });

    if (endedUserId != null) {
      await this.deps.onRepAssignmentChanged?.([endedUserId]);
    }
    // Profile deactivate always changes Meili verticalIds / repUserIds.
    await this.deps.onFacilityChanged?.(input.facilityId);

    return {
      success: true as const,
      facilityId: input.facilityId,
      verticalId: input.verticalId,
      userId: endedUserId ?? undefined,
    };
  }
}
