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
        // Spec 0009 R2: an override is reportable wherever the assignment is.
        overrideReason: assignment.overrideReason ?? undefined,
        overrideByUserId: assignment.overrideByUserId ?? undefined,
        isCurrent: assignment.endedAt === null,
      })),
    };
  }
}

/**
 * Spec 0009 R2's acceptance criterion: overrides are reportable — "how many
 * out-of-territory assignments exist, who approved them, why".
 *
 * Scoped by the caller's verticals rather than by territory: an override is by
 * definition outside the geometry, so territory scope would hide exactly the
 * rows the report exists to show.
 */
export class ListOutOfTerritoryAssignmentsUseCase {
  constructor(
    private readonly deps: {
      repAssignmentRepository: FacilityVerticalRepAssignmentRepository;
    },
  ) {}

  async execute(input: {
    scope: ScopeContext;
    role: string;
    page?: number;
    limit?: number;
  }) {
    const page = input.page ?? 1;
    const limit = input.limit ?? 20;

    const verticalIds = input.scope.isGlobal
      ? undefined
      : (input.scope.assignedVerticalIds ?? []);

    // A non-global caller with no verticals can see nothing, and an empty list
    // must not be read downstream as "no filter".
    if (verticalIds && verticalIds.length === 0) {
      return { data: [], pagination: { page, limit, total: 0, totalPages: 1 } };
    }

    const { rows, total } =
      await this.deps.repAssignmentRepository.findOutOfTerritoryAssignments({
        verticalIds,
        limit,
        offset: (page - 1) * limit,
      });

    return {
      data: rows.map((row) => ({
        assignmentId: row.assignmentId,
        facilityId: row.facilityId,
        facilityName: row.facilityName,
        verticalId: row.verticalId,
        userId: row.userId,
        userName: row.userName,
        overrideReason: row.overrideReason,
        overrideByUserId: row.overrideByUserId ?? undefined,
        overrideByName: row.overrideByName ?? undefined,
        startedAt: row.startedAt.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
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
    /**
     * Spec 0009 R2. Assigning a rep outside their patch is routine in the
     * informal market, so it is allowed — but only on the record. Supplying a
     * reason satisfies I2 in place of geometric coverage; omitting it keeps the
     * old behaviour, which is to refuse.
     */
    overrideReason?: string;
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);
    assertActorVerticalInScope(input);

    await this.deps.assertVerticalActive(input.verticalId);
    await this.deps.assertAssigneeHasVertical({
      userId: input.userId,
      verticalId: input.verticalId,
    });

    const overrideReason = input.overrideReason?.trim();
    if (overrideReason !== undefined && overrideReason.length === 0) {
      throw new ValidationError([
        {
          field: "overrideReason",
          message: "An override must say why; an empty reason is not a reason",
        },
      ]);
    }

    // I2: a patch covers the clinic **or** the assignment carries an override.
    // Whoever may assign the rep may override — the same scope rule already
    // applied above. R2 is about reportability, not gating: making it
    // admin-only would produce the worse workaround of a throwaway patch drawn
    // around the clinic.
    if (!overrideReason) {
      await this.deps.assertAssigneeCoversFacility?.({
        userId: input.userId,
        facilityId: input.facilityId,
      });
    }

    const { assignment, previousUserId } =
      await this.deps.repAssignmentRepository.assign({
        facilityId: input.facilityId,
        verticalId: input.verticalId,
        userId: input.userId,
        assignedByUserId: input.assignedByUserId,
        overrideReason: overrideReason ?? null,
        overrideByUserId: overrideReason ? input.assignedByUserId : null,
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
      overrideReason: assignment.overrideReason ?? undefined,
      overrideByUserId: assignment.overrideByUserId ?? undefined,
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
