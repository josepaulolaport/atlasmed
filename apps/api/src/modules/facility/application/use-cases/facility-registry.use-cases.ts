import type { ScopeContext } from "@atlasmed/access";
import { assertResourceInScope } from "@atlasmed/access";
import { ResourceNotFoundError, ValidationError } from "../../../../shared/errors";
import type { FacilityProfessionalRepository } from "../interfaces/facility-professional.repository.interface";
import type { FacilityRepresentativeRepository } from "../interfaces/facility-representative.repository.interface";
import type { FacilityConsultantAssignmentRepository } from "../interfaces/facility-consultant-assignment.repository.interface";
import type { FacilityRepository } from "../interfaces/facility.repository.interface";
import type { RegistryReadRepository } from "../../../registry-ingestion/application/interfaces/registry-read.repository.interface";

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
    }
  ) {}

  async execute(input: {
    facilityId: string;
    userId: string;
    assignedByUserId: string;
    scope: ScopeContext;
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);

    const assignment = await this.deps.consultantAssignmentRepository.assign({
      facilityId: input.facilityId,
      userId: input.userId,
      assignedByUserId: input.assignedByUserId,
    });

    return {
      id: assignment.id,
      facilityId: assignment.facilityId,
      userId: assignment.userId,
      startedAt: assignment.startedAt.toISOString(),
      assignedByUserId: assignment.assignedByUserId ?? undefined,
    };
  }
}
