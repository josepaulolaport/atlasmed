import { facilityPhotos } from "@atlasmed/database";
import { asc, eq } from "drizzle-orm";
import { db } from "../../../../../infrastructure/database/db";
import type {
  FacilityPhotoRecord,
  FacilityPhotoRepository,
} from "../../../application/interfaces/facility-photo.repository.interface";

type PhotoRow = typeof facilityPhotos.$inferSelect;

function mapPhoto(row: PhotoRow): FacilityPhotoRecord {
  return {
    id: row.id,
    facilityId: row.facilityId,
    storageKey: row.storageKey,
    url: row.url,
    contentType: row.contentType,
    blurhash: row.blurhash ?? null,
    uploadedByUserId: row.uploadedByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleFacilityPhotoRepository implements FacilityPhotoRepository {
  async findByFacility(facilityId: string): Promise<FacilityPhotoRecord[]> {
    const rows = await db
      .select()
      .from(facilityPhotos)
      .where(eq(facilityPhotos.facilityId, facilityId))
      .orderBy(asc(facilityPhotos.createdAt));

    return rows.map(mapPhoto);
  }

  async create(input: {
    facilityId: string;
    storageKey: string;
    url: string;
    contentType: string;
    blurhash?: string | null;
    uploadedByUserId: string;
  }): Promise<FacilityPhotoRecord> {
    const [row] = await db.insert(facilityPhotos).values(input).returning();
    return mapPhoto(row!);
  }

  async findById(id: string): Promise<FacilityPhotoRecord | null> {
    const [row] = await db
      .select()
      .from(facilityPhotos)
      .where(eq(facilityPhotos.id, id))
      .limit(1);
    return row ? mapPhoto(row) : null;
  }

  async findByStorageKey(storageKey: string): Promise<FacilityPhotoRecord | null> {
    const [row] = await db
      .select()
      .from(facilityPhotos)
      .where(eq(facilityPhotos.storageKey, storageKey))
      .limit(1);
    return row ? mapPhoto(row) : null;
  }
}
