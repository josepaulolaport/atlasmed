/**
 * Per-user relationship strength with a CRM person (1–10).
 * Same privacy model as person_notes — never facility-scoped.
 */
export interface UserPersonRelationshipRecord {
  id: number;
  userId: number;
  personId: number;
  relationshipLevel: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPersonRelationshipRepository {
  /** Active (non-deleted) person, or null. */
  findActivePersonById(personId: number): Promise<{ id: number } | null>;

  findByUserAndPerson(
    userId: number,
    personId: number
  ): Promise<UserPersonRelationshipRecord | null>;

  /** Map personId → level for the given user (for roster enrichment). */
  findLevelsByUserAndPersons(
    userId: number,
    personIds: number[]
  ): Promise<Map<number, number>>;

  upsert(params: {
    userId: number;
    personId: number;
    relationshipLevel: number;
  }): Promise<UserPersonRelationshipRecord>;
}
