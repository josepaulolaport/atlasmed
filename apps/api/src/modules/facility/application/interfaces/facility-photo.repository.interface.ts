export interface FacilityPhotoRecord {
  id: string;
  facilityId: string;
  storageKey: string;
  url: string;
  contentType: string;
  blurhash: string | null;
  uploadedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FacilityPhotoRepository {
  findByFacility(facilityId: string): Promise<FacilityPhotoRecord[]>;

  create(input: {
    facilityId: string;
    storageKey: string;
    url: string;
    contentType: string;
    blurhash?: string | null;
    uploadedByUserId: string;
  }): Promise<FacilityPhotoRecord>;

  findById(id: string): Promise<FacilityPhotoRecord | null>;

  findByStorageKey(storageKey: string): Promise<FacilityPhotoRecord | null>;
}
