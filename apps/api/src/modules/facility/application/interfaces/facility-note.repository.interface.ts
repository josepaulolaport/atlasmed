export interface FacilityNoteRecord {
  id: string;
  userId: string;
  facilityId: string;
  note: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FacilityNoteRepository {
  findByFacilityAndUser(
    facilityId: string,
    userId: string
  ): Promise<FacilityNoteRecord[]>;

  create(input: {
    facilityId: string;
    userId: string;
    note: string;
  }): Promise<FacilityNoteRecord>;
}
