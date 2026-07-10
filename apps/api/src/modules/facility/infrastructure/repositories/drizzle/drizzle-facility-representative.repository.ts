import {
  facilityRepresentatives,
} from "@atlasmed/database";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "../../../../../infrastructure/database/db";
import type {
  FacilityRepresentativeRecord,
  FacilityRepresentativeRepository,
} from "../../../application/interfaces/facility-representative.repository.interface";

type RepresentativeRow = typeof facilityRepresentatives.$inferSelect;

function mapRepresentative(row: RepresentativeRow): FacilityRepresentativeRecord {
  return {
    id: row.id,
    facilityId: row.facilityId,
    representativeName: row.representativeName,
    roleTitle: row.roleTitle,
    email: row.email,
    taxId: row.taxId,
    externalSourceKey: row.externalSourceKey,
    sourceActive: row.sourceActive,
    confirmedAt: row.confirmedAt,
    confirmedByUserId: row.confirmedByUserId,
    endedAt: row.endedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleFacilityRepresentativeRepository implements FacilityRepresentativeRepository {
  async findByFacilityAndExternalKey(
    facilityId: string,
    externalKey: string
  ): Promise<FacilityRepresentativeRecord | null> {
    const [representative] = await db
      .select()
      .from(facilityRepresentatives)
      .where(
        and(
          eq(facilityRepresentatives.facilityId, facilityId),
          eq(facilityRepresentatives.externalSourceKey, externalKey),
          isNull(facilityRepresentatives.endedAt)
        )
      )
      .limit(1);

    return representative ? mapRepresentative(representative) : null;
  }

  async upsertFromRegistry(params: {
    facilityId: string;
    externalSourceKey: string;
    representativeName: string;
    roleTitle?: string | null;
    email?: string | null;
    taxId?: string | null;
  }): Promise<FacilityRepresentativeRecord> {
    const [representative] = await db
      .insert(facilityRepresentatives)
      .values({
        facilityId: params.facilityId,
        externalSourceKey: params.externalSourceKey,
        representativeName: params.representativeName,
        roleTitle: params.roleTitle ?? null,
        email: params.email ?? null,
        taxId: params.taxId ?? null,
        sourceActive: true,
        sourceProvider: "registry",
      })
      .onConflictDoUpdate({
        target: [facilityRepresentatives.facilityId, facilityRepresentatives.externalSourceKey],
        set: {
          representativeName: params.representativeName,
          roleTitle: params.roleTitle ?? null,
          email: params.email ?? null,
          taxId: params.taxId ?? null,
          sourceActive: true,
          updatedAt: new Date(),
        },
      })
      .returning();

    return mapRepresentative(representative!);
  }

  async confirm(params: {
    facilityId: string;
    externalSourceKey: string;
    confirmedByUserId: string;
  }): Promise<FacilityRepresentativeRecord> {
    const [representative] = await db
      .update(facilityRepresentatives)
      .set({
        confirmedAt: new Date(),
        confirmedByUserId: params.confirmedByUserId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(facilityRepresentatives.facilityId, params.facilityId),
          eq(facilityRepresentatives.externalSourceKey, params.externalSourceKey)
        )
      )
      .returning();

    return mapRepresentative(representative!);
  }

  async endSourceRepresentative(params: {
    facilityId: string;
    externalSourceKey: string;
    endedByUserId: string;
    endReason?: string;
  }): Promise<FacilityRepresentativeRecord | null> {
    const [existing] = await db
      .select()
      .from(facilityRepresentatives)
      .where(
        and(
          eq(facilityRepresentatives.facilityId, params.facilityId),
          eq(facilityRepresentatives.externalSourceKey, params.externalSourceKey),
          isNull(facilityRepresentatives.endedAt)
        )
      )
      .limit(1);

    if (!existing) return null;

    const [representative] = await db
      .update(facilityRepresentatives)
      .set({
        endedAt: new Date(),
        sourceActive: false,
        updatedAt: new Date(),
      })
      .where(eq(facilityRepresentatives.id, existing.id))
      .returning();

    return mapRepresentative(representative!);
  }
}
