export interface FacilityPhotoRecord {
  id: number;
  facilityId: number;
  storageKey: string;
  url: string;
  contentType: string;
  blurhash: string | null;
  uploadedByUserId: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FacilityPhotoRepository {
  findByFacility(facilityId: number): Promise<FacilityPhotoRecord[]>;

  create(input: {
    facilityId: number;
    storageKey: string;
    url: string;
    contentType: string;
    blurhash?: string | null;
    uploadedByUserId: number;
  }): Promise<FacilityPhotoRecord>;

  findById(id: number): Promise<FacilityPhotoRecord | null>;

  findByStorageKey(storageKey: string): Promise<FacilityPhotoRecord | null>;
}
