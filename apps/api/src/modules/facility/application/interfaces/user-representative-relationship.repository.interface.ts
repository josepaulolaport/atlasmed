/**
 * Per-user relationship strength with a CRM facility representative (1–10).
 * Same privacy model as user_professional_relationships.
 */
export interface UserRepresentativeRelationshipRecord {
  id: number;
  userId: number;
  representativeId: number;
  relationshipLevel: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserRepresentativeRelationshipRepository {
  findByUserAndRepresentative(
    userId: number,
    representativeId: number
  ): Promise<UserRepresentativeRelationshipRecord | null>;

  /** Map representativeId → level for the given user (for roster enrichment). */
  findLevelsByUserAndRepresentatives(
    userId: number,
    representativeIds: number[]
  ): Promise<Map<number, number>>;

  upsert(params: {
    userId: number;
    representativeId: number;
    relationshipLevel: number;
  }): Promise<UserRepresentativeRelationshipRecord>;

  deleteByUserAndRepresentative(
    userId: number,
    representativeId: number
  ): Promise<void>;
}
