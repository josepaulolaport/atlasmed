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

  /** Caller-owned only. `null` when missing or not owned by `userId`. */
  updateOwned(input: {
    noteId: number;
    personId: number;
    userId: number;
    note: string;
  }): Promise<PersonNoteRecord | null>;

  /** Hard delete, caller-owned only. `false` when missing or not owned. */
  deleteOwned(input: {
    noteId: number;
    personId: number;
    userId: number;
  }): Promise<boolean>;
}
