/**
 * Per-user relationship strength with a CRM professional (1–10).
 * Same privacy model as professional_notes — never facility-scoped.
 */
export interface UserProfessionalRelationshipRecord {
  id: number;
  userId: number;
  professionalId: number;
  relationshipLevel: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfessionalRelationshipRepository {
  findByUserAndProfessional(
    userId: number,
    professionalId: number
  ): Promise<UserProfessionalRelationshipRecord | null>;

  /** Map professionalId → level for the given user (for roster enrichment). */
  findLevelsByUserAndProfessionals(
    userId: number,
    professionalIds: number[]
  ): Promise<Map<number, number>>;

  upsert(params: {
    userId: number;
    professionalId: number;
    relationshipLevel: number;
  }): Promise<UserProfessionalRelationshipRecord>;

  /** Clears the user's relationship score for a professional. */
  deleteByUserAndProfessional(
    userId: number,
    professionalId: number
  ): Promise<void>;
}
