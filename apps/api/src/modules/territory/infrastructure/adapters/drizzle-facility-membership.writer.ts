import { db } from "../../../../infrastructure/database/db";
import { businessVerticals, facilities, facilityVerticalProfiles } from "@atlasmed/database";
import { eq, isNull, and, inArray, sql } from "drizzle-orm";
import type {
  ClinicMembershipTarget,
  ClinicMembershipWriter,
} from "../../application/services/territory-membership.service";

export class DrizzleClinicMembershipWriter implements ClinicMembershipWriter {
  async updateProfileTerritoryMemberships(
    facilityId: string,
    memberships: Array<{ verticalId: string; territoryId: string | null }>
  ): Promise<void> {
    await db.transaction(async (tx) => {
      await tx
        .update(facilityVerticalProfiles)
        .set({
          territoryId: null,
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
            territoryId: membership.territoryId,
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

  async updateTerritoryMembership(
    facilityId: string,
    data: {
      territoryId: string | null;
      territoryAssignmentStatus: "assigned" | "unassigned" | "ambiguous";
      territoryAssignmentSource: "geo" | "manual";
    }
  ): Promise<void> {
    // Membership lives on facility_vertical_profiles.territory_id.
    // Keep assignment status flags on the facility row for legacy clients until dropped.
    await db
      .update(facilities)
      .set({
        territoryAssignmentStatus: data.territoryAssignmentStatus,
        territoryAssignmentSource: data.territoryAssignmentSource,
        updatedAt: new Date(),
      })
      .where(eq(facilities.id, facilityId));
  }

  async findOrtopediaVerticalId(): Promise<string | null> {
    const rows = await db
      .select({ id: businessVerticals.id })
      .from(businessVerticals)
      .where(and(eq(businessVerticals.code, "ORTOPEDIA"), eq(businessVerticals.isActive, true)))
      .limit(1);

    return rows[0]?.id ?? null;
  }

  async findClinicsForMembership(params?: {
    facilityIds?: string[];
    territoryIds?: string[];
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
            AND ${inArray(facilityVerticalProfiles.territoryId, params.territoryIds)}
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
        territoryId: sql<string | null>`(
          SELECT ${facilityVerticalProfiles.territoryId}
          FROM ${facilityVerticalProfiles}
          WHERE ${facilityVerticalProfiles.facilityId} = ${facilities.id}
            AND ${facilityVerticalProfiles.isActive} = true
            AND ${facilityVerticalProfiles.territoryId} IS NOT NULL
          ORDER BY ${facilityVerticalProfiles.updatedAt} DESC
          LIMIT 1
        )`,
        territoryAssignmentSource: facilities.territoryAssignmentSource,
        territoryAssignmentStatus: facilities.territoryAssignmentStatus,
      })
      .from(facilities)
      .where(and(...conditions));

    return rows;
  }
}
