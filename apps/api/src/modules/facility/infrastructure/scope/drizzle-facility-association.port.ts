import type { FacilityAssociationPort } from "../../../access/application/interfaces/scope.repository.interface";
import type { FacilityVerticalRepAssignmentRepository } from "../../application/interfaces/facility-vertical-rep-assignment.repository.interface";

export class DrizzleFacilityAssociationPort implements FacilityAssociationPort {
  constructor(
    private readonly repAssignmentRepository: FacilityVerticalRepAssignmentRepository,
  ) {}

  async getAssociatedFacilityIds(
    userId: number,
    verticalIds?: number[],
  ): Promise<number[]> {
    return this.repAssignmentRepository.findActiveFacilityIdsByUserId(
      userId,
      verticalIds,
    );
  }
}
