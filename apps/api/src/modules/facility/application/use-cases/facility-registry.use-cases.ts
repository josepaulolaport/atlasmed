import type { ScopeContext } from "@atlasmed/access";
import { assertResourceInScope } from "@atlasmed/access";
import { ResourceNotFoundError, ValidationError } from "../../../../shared/errors";
import type { FacilityProfessionalRepository } from "../interfaces/facility-professional.repository.interface";
import type { FacilityRepresentativeRepository } from "../interfaces/facility-representative.repository.interface";
import type { FacilityConsultantAssignmentRepository } from "../interfaces/facility-consultant-assignment.repository.interface";
import type { FacilityRepository } from "../interfaces/facility.repository.interface";
import type { RegistryReadRepository } from "../../../registry-ingestion/application/interfaces/registry-read.repository.interface";
import { resolveVerticalIds } from "../../../access/application/services/vertical-access.service";

export class ConfirmRegistryProfessionalUseCase {
  constructor(
    private readonly deps: {
      facilityProfessionalRepository: FacilityProfessionalRepository;
      facilityRepository: FacilityRepository;
      registryReadRepository: RegistryReadRepository;
    }
  ) {}

  async execute(input: {
    facilityId: string;
    professionalId: string;
    occupationCode: string;
    userId: string;
    scope: ScopeContext;
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);

    const facility = await this.deps.facilityRepository.findById(input.facilityId);
    if (!facility?.externalSourceId) {
      throw new ValidationError([
        { field: "facilityId", message: "Facility has no registry linkage" },
      ]);
    }

    const registryProfessionals =
      await this.deps.registryReadRepository.findProfessionalsByFacility(
        facility.externalSourceId
      );

    const registryMatch = registryProfessionals.find(
      (row) => row.professionalId === input.professionalId
    );

    if (!registryMatch) {
      throw new ResourceNotFoundError("RegistryProfessional", input.professionalId);
    }

    if (registryMatch.occupationCode !== input.occupationCode) {
      throw new ValidationError([
        { field: "occupationCode", message: "Occupation code does not match registry record" },
      ]);
    }

    const association = await this.deps.facilityProfessionalRepository.confirmAssociation({
      professionalId: input.professionalId,
      facilityId: input.facilityId,
      occupationCode: input.occupationCode,
      confirmedByUserId: input.userId,
    });

    return {
      facilityProfessionalId: association.id,
      professionalId: association.professionalId,
      facilityId: association.facilityId,
      occupationCode: association.occupationCode,
      confirmedAt: association.confirmedAt?.toISOString(),
    };
  }
}

export class ConfirmRegistryRepresentativeUseCase {
  constructor(
    private readonly deps: {
      facilityRepresentativeRepository: FacilityRepresentativeRepository;
      facilityRepository: FacilityRepository;
      registryReadRepository: RegistryReadRepository;
    }
  ) {}

  async execute(input: {
    facilityId: string;
    externalKey: string;
    userId: string;
    scope: ScopeContext;
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);

    const facility = await this.deps.facilityRepository.findById(input.facilityId);
    if (!facility?.externalSourceId) {
      throw new ValidationError([
        { field: "facilityId", message: "Facility has no registry linkage" },
      ]);
    }

    const registryRepresentatives =
      await this.deps.registryReadRepository.findRepresentativesByFacility(
        facility.externalSourceId
      );

    const registryMatch = registryRepresentatives.find(
      (row) => row.externalKey === input.externalKey
    );

    if (!registryMatch) {
      throw new ResourceNotFoundError("RegistryRepresentative", input.externalKey);
    }

    await this.deps.facilityRepresentativeRepository.upsertFromRegistry({
      facilityId: input.facilityId,
      externalSourceKey: input.externalKey,
      representativeName: registryMatch.representativeName,
      roleTitle: registryMatch.roleTitle,
      email: registryMatch.email,
      taxId: registryMatch.taxId,
    });

    const representative = await this.deps.facilityRepresentativeRepository.confirm({
      facilityId: input.facilityId,
      externalSourceKey: input.externalKey,
      confirmedByUserId: input.userId,
    });

    return {
      id: representative.id,
      facilityId: representative.facilityId,
      externalSourceKey: representative.externalSourceKey,
      representativeName: representative.representativeName,
      confirmedAt: representative.confirmedAt?.toISOString(),
    };
  }
}

export class ListFacilityConsultantAssignmentsUseCase {
  constructor(
    private readonly deps: {
      consultantAssignmentRepository: FacilityConsultantAssignmentRepository;
    }
  ) {}

  async execute(input: { facilityId: string; scope: ScopeContext }) {
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
        userId: string;
        facilityId: string;
      }) => Promise<void>;
      onConsultantAssignmentChanged?: (userIds: string[]) => Promise<void>;
    }
  ) {}

  async execute(input: {
    facilityId: string;
    userId: string;
    assignedByUserId: string;
    verticalId?: string;
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
      onConsultantAssignmentChanged?: (userIds: string[]) => Promise<void>;
    }
  ) {}

  async execute(input: {
    facilityId: string;
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
