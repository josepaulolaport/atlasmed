export interface PersonNoteRecord {
  id: number;
  userId: number;
  personId: number;
  note: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PersonNoteRepository {
  /** Active (non-deleted) person, or null. */
  findActivePersonById(personId: number): Promise<{ id: number } | null>;

  findByPersonAndUser(
    personId: number,
    userId: number
  ): Promise<PersonNoteRecord[]>;

  create(input: {
    personId: number;
    userId: number;
    note: string;
  }): Promise<PersonNoteRecord>;
}
