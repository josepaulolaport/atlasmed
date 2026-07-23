import type { FacilityAssociationPort } from "../../../access/application/interfaces/scope.repository.interface";
import type { FacilityConsultantAssignmentRepository } from "../../application/interfaces/facility-consultant-assignment.repository.interface";

export class DrizzleFacilityAssociationPort implements FacilityAssociationPort {
  constructor(
    private readonly consultantAssignmentRepository: FacilityConsultantAssignmentRepository,
  ) {}

  async getAssociatedFacilityIds(userId: string): Promise<string[]> {
    return this.consultantAssignmentRepository.findActiveFacilityIdsByUserId(
      userId,
    );
  }
}
