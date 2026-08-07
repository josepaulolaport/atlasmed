import type { FacilityAssociationPort } from "../../../access/application/interfaces/scope.repository.interface";
import type { FacilityConsultantAssignmentRepository } from "../../application/interfaces/facility-consultant-assignment.repository.interface";

export class DrizzleFacilityAssociationPort implements FacilityAssociationPort {
  constructor(
    private readonly consultantAssignmentRepository: FacilityConsultantAssignmentRepository,
  ) {}

  async getAssociatedFacilityIds(
    userId: number,
    verticalIds?: number[],
  ): Promise<number[]> {
    return this.consultantAssignmentRepository.findActiveFacilityIdsByUserId(
      userId,
      verticalIds,
    );
  }
}
