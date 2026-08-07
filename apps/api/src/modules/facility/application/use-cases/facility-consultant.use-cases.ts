import type { ScopeContext } from "@atlasmed/access";
import { assertResourceInScope } from "@atlasmed/access";
import { ResourceNotFoundError, ValidationError } from "../../../../shared/errors";
import type { FacilityConsultantAssignmentRepository } from "../interfaces/facility-consultant-assignment.repository.interface";
import { resolveVerticalIds } from "../../../access/application/services/vertical-access.service";

export class ListFacilityConsultantAssignmentsUseCase {
  constructor(
    private readonly deps: {
      consultantAssignmentRepository: FacilityConsultantAssignmentRepository;
    }
  ) {}

  async execute(input: { facilityId: number; scope: ScopeContext }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);

    const assignments = await this.deps.consultantAssignmentRepository.findByFacility(
      input.facilityId
    );

    return {
      data: assignments.map((assignment) => ({
        id: assignment.id,
        facilityId: assignment.facilityId,
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

export class AssignFacilityConsultantUseCase {
  constructor(
    private readonly deps: {
      consultantAssignmentRepository: FacilityConsultantAssignmentRepository;
      /** Spec 0006 restricted assign: assignee must cover clinic with a rep patch. */
      assertAssigneeCoversFacility?: (input: {
        userId: number;
        facilityId: number;
      }) => Promise<void>;
      onConsultantAssignmentChanged?: (userIds: number[]) => Promise<void>;
    }
  ) {}

  async execute(input: {
    facilityId: number;
    userId: number;
    assignedByUserId: number;
    verticalId?: number;
    scope: ScopeContext;
    role: string;
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);

    const resolvedVerticalIds = resolveVerticalIds({
      role: input.role,
      assignedVerticalIds: input.scope.assignedVerticalIds ?? [],
      queryVerticalId: input.verticalId,
    });
    if (resolvedVerticalIds.length !== 1) {
      throw new ValidationError([
        {
          field: "verticalId",
          message: "verticalId is required when multiple verticals apply",
        },
      ]);
    }
    const verticalId = resolvedVerticalIds[0]!;

    await this.deps.assertAssigneeCoversFacility?.({
      userId: input.userId,
      facilityId: input.facilityId,
    });

    const previous =
      await this.deps.consultantAssignmentRepository.findCurrentByFacility(
        input.facilityId,
      );

    const assignment = await this.deps.consultantAssignmentRepository.assign({
      facilityId: input.facilityId,
      userId: input.userId,
      verticalId,
      assignedByUserId: input.assignedByUserId,
    });

    const affectedUserIds = [
      input.userId,
      ...(previous && previous.userId !== input.userId
        ? [previous.userId]
        : []),
    ];
    await this.deps.onConsultantAssignmentChanged?.(affectedUserIds);

    return {
      id: assignment.id,
      facilityId: assignment.facilityId,
      userId: assignment.userId,
      startedAt: assignment.startedAt.toISOString(),
      assignedByUserId: assignment.assignedByUserId ?? undefined,
    };
  }
}

export class UnassignFacilityConsultantUseCase {
  constructor(
    private readonly deps: {
      consultantAssignmentRepository: FacilityConsultantAssignmentRepository;
      onConsultantAssignmentChanged?: (userIds: number[]) => Promise<void>;
    }
  ) {}

  async execute(input: {
    facilityId: number;
    scope: ScopeContext;
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);

    const current =
      await this.deps.consultantAssignmentRepository.findCurrentByFacility(
        input.facilityId,
      );
    if (!current) {
      throw new ResourceNotFoundError("FacilityConsultantAssignment", input.facilityId);
    }

    await this.deps.consultantAssignmentRepository.endActiveForFacilities({
      facilityIds: [input.facilityId],
      endReason: "manual_unassign",
    });

    await this.deps.onConsultantAssignmentChanged?.([current.userId]);

    return { success: true as const, facilityId: input.facilityId, userId: current.userId };
  }
}
