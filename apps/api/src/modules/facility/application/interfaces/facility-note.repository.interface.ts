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
}
