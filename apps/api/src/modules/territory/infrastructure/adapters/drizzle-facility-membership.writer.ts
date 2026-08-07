import { db } from "../../../../infrastructure/database/db";
import {
  facilities,
  facilityConsultantAssignments,
  facilityVerticalProfiles,
  territories,
} from "@atlasmed/database";
import { eq, isNull, and, inArray, sql } from "drizzle-orm";
import type {
  ClinicMembershipTarget,
  ClinicMembershipWriter,
} from "../../application/services/territory-membership.service";

export class DrizzleClinicMembershipWriter implements ClinicMembershipWriter {
  async updateProfileTerritoryMemberships(
    facilityId: number,
    memberships: Array<{ verticalId: number; managerZoneId: number | null }>
  ): Promise<void> {
    await db.transaction(async (tx) => {
      await tx
        .update(facilityVerticalProfiles)
        .set({
          managerZoneId: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(facilityVerticalProfiles.facilityId, facilityId),
            eq(facilityVerticalProfiles.isActive, true)
          )
        );

      for (const membership of memberships) {
        await tx
          .update(facilityVerticalProfiles)
          .set({
            managerZoneId: membership.managerZoneId,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(facilityVerticalProfiles.facilityId, facilityId),
              eq(facilityVerticalProfiles.verticalId, membership.verticalId),
              eq(facilityVerticalProfiles.isActive, true)
            )
          );
      }
    });
  }

  async setProfileTerritory(
    facilityId: number,
    verticalId: number,
    managerZoneId: number | null,
  ): Promise<void> {
    await db
      .update(facilityVerticalProfiles)
      .set({
        managerZoneId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(facilityVerticalProfiles.facilityId, facilityId),
          eq(facilityVerticalProfiles.verticalId, verticalId),
          eq(facilityVerticalProfiles.isActive, true),
        ),
      );
  }

  async findClinicsForMembership(params?: {
    facilityIds?: number[];
    territoryIds?: number[];
    boundingBox?: { minLng: number; minLat: number; maxLng: number; maxLat: number };
  }): Promise<ClinicMembershipTarget[]> {
    const conditions = [isNull(facilities.deactivatedAt)];

    if (params?.facilityIds?.length) {
      conditions.push(inArray(facilities.id, params.facilityIds));
    }
    if (params?.territoryIds?.length) {
      conditions.push(
        sql`EXISTS (
          SELECT 1
          FROM ${facilityVerticalProfiles}
          WHERE ${facilityVerticalProfiles.facilityId} = ${facilities.id}
            AND ${facilityVerticalProfiles.isActive} = true
            AND ${inArray(facilityVerticalProfiles.managerZoneId, params.territoryIds)}
        )`
      );
    }
    if (params?.boundingBox) {
      const { minLng, maxLng, minLat, maxLat } = params.boundingBox;
      conditions.push(
        sql`ST_X(${facilities.location}::geometry) BETWEEN ${minLng} AND ${maxLng}`,
        sql`ST_Y(${facilities.location}::geometry) BETWEEN ${minLat} AND ${maxLat}`
      );
    }

    const rows = await db
      .select({
        id: facilities.id,
        lat: sql<number | null>`ST_Y(${facilities.location}::geometry)`,
        lng: sql<number | null>`ST_X(${facilities.location}::geometry)`,
        managerZoneId: sql<number | null>`(
          SELECT ${facilityVerticalProfiles.managerZoneId}
          FROM ${facilityVerticalProfiles}
          WHERE ${facilityVerticalProfiles.facilityId} = ${facilities.id}
            AND ${facilityVerticalProfiles.isActive} = true
            AND ${facilityVerticalProfiles.managerZoneId} IS NOT NULL
          ORDER BY ${facilityVerticalProfiles.updatedAt} DESC
          LIMIT 1
        )`,
      })
      .from(facilities)
      .where(and(...conditions));

    return rows;
  }

  async findClinicsWithoutConsultant(params: {
    managerZoneIds?: number[];
    global: boolean;
  }): Promise<
    Array<{
      id: number;
      displayName: string;
      lat: number | null;
      lng: number | null;
      managerZoneId: number;
      managerZoneName: string | null;
    }>
  > {
    if (!params.global && !params.managerZoneIds?.length) {
      return [];
    }

    const zoneFilter =
      !params.global && params.managerZoneIds?.length
        ? inArray(facilityVerticalProfiles.managerZoneId, params.managerZoneIds)
        : sql`${facilityVerticalProfiles.managerZoneId} IS NOT NULL`;

    const rows = await db
      .select({
        id: facilities.id,
        displayName: facilities.displayName,
        lat: sql<number | null>`ST_Y(${facilities.location}::geometry)`,
        lng: sql<number | null>`ST_X(${facilities.location}::geometry)`,
        managerZoneId: facilityVerticalProfiles.managerZoneId,
        managerZoneName: territories.name,
      })
      .from(facilities)
      .innerJoin(
        facilityVerticalProfiles,
        and(
          eq(facilityVerticalProfiles.facilityId, facilities.id),
          eq(facilityVerticalProfiles.isActive, true),
          zoneFilter,
        ),
      )
      .leftJoin(
        territories,
        eq(territories.id, facilityVerticalProfiles.managerZoneId),
      )
      .where(
        and(
          isNull(facilities.deactivatedAt),
          sql`NOT EXISTS (
            SELECT 1
            FROM ${facilityConsultantAssignments}
            WHERE ${facilityConsultantAssignments.facilityId} = ${facilities.id}
              AND ${facilityConsultantAssignments.endedAt} IS NULL
          )`,
        ),
      );

    const seen = new Set<number>();
    const unique: Array<{
      id: number;
      displayName: string;
      lat: number | null;
      lng: number | null;
      managerZoneId: number;
      managerZoneName: string | null;
    }> = [];

    for (const row of rows) {
      if (!row.managerZoneId || seen.has(row.id)) continue;
      seen.add(row.id);
      unique.push({
        id: row.id,
        displayName: row.displayName,
        lat: row.lat,
        lng: row.lng,
        managerZoneId: row.managerZoneId,
        managerZoneName: row.managerZoneName,
      });
    }

    return unique;
  }
}
