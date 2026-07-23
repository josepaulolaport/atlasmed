/**
 * Per-user relationship strength with a CRM facility representative (1–10).
 * Same privacy model as user_professional_relationships.
 */
export interface UserRepresentativeRelationshipRecord {
  id: string;
  userId: string;
  representativeId: string;
  relationshipLevel: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserRepresentativeRelationshipRepository {
  findByUserAndRepresentative(
    userId: string,
    representativeId: string
  ): Promise<UserRepresentativeRelationshipRecord | null>;

  /** Map representativeId → level for the given user (for roster enrichment). */
  findLevelsByUserAndRepresentatives(
    userId: string,
    representativeIds: string[]
  ): Promise<Map<string, number>>;

  upsert(params: {
    userId: string;
    representativeId: string;
    relationshipLevel: number;
  }): Promise<UserRepresentativeRelationshipRecord>;

  deleteByUserAndRepresentative(
    userId: string,
    representativeId: string
  ): Promise<void>;
}
