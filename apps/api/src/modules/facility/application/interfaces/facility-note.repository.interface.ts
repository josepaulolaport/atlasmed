export interface FacilityNoteRecord {
  id: number;
  userId: number;
  facilityId: number;
  note: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FacilityNoteRepository {
  findByFacilityAndUser(
    facilityId: number,
    userId: number
  ): Promise<FacilityNoteRecord[]>;

  create(input: {
    facilityId: number;
    userId: number;
    note: string;
  }): Promise<FacilityNoteRecord>;

  /** Caller-owned only. `null` when missing or not owned by `userId`. */
  updateOwned(input: {
    noteId: number;
    facilityId: number;
    userId: number;
    note: string;
  }): Promise<FacilityNoteRecord | null>;

  /** Hard delete, caller-owned only. `false` when missing or not owned. */
  deleteOwned(input: {
    noteId: number;
    facilityId: number;
    userId: number;
  }): Promise<boolean>;
}
