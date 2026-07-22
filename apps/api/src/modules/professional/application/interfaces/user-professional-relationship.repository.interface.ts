/**
 * Per-user relationship strength with a CRM professional (1–10).
 * Same privacy model as professional_notes — never facility-scoped.
 */
export interface UserProfessionalRelationshipRecord {
  id: string;
  userId: string;
  professionalId: string;
  relationshipLevel: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfessionalRelationshipRepository {
  findByUserAndProfessional(
    userId: string,
    professionalId: string
  ): Promise<UserProfessionalRelationshipRecord | null>;

  /** Map professionalId → level for the given user (for roster enrichment). */
  findLevelsByUserAndProfessionals(
    userId: string,
    professionalIds: string[]
  ): Promise<Map<string, number>>;

  upsert(params: {
    userId: string;
    professionalId: string;
    relationshipLevel: number;
  }): Promise<UserProfessionalRelationshipRecord>;

  /** Clears the user's relationship score for a professional. */
  deleteByUserAndProfessional(
    userId: string,
    professionalId: string
  ): Promise<void>;
}
