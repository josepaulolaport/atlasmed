import {
  facilityVerticalProfiles,
  facilityVerticalRepAssignments,
} from "@atlasmed/database";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../../../../../infrastructure/database/db";
import { ResourceConflictError } from "../../../../../shared/errors";
import { isPostgresUniqueViolation } from "../../../../person/infrastructure/repositories/drizzle/postgres-unique-violation";
import type {
  FacilityVerticalRepAssignmentRecord,
  FacilityVerticalRepAssignmentRepository,
} from "../../../application/interfaces/facility-vertical-rep-assignment.repository.interface";

type AssignmentRow = typeof facilityVerticalRepAssignments.$inferSelect;
type ProfileRow = typeof facilityVerticalProfiles.$inferSelect;

function mapAssignment(
  row: AssignmentRow,
  profile: Pick<ProfileRow, "facilityId" | "verticalId">,
): FacilityVerticalRepAssignmentRecord {
  return {
    id: row.id,
    facilityVerticalProfileId: row.facilityVerticalProfileId,
    facilityId: profile.facilityId,
    verticalId: profile.verticalId,
    userId: row.userId,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    assignedByUserId: row.assignedByUserId,
    endReason: row.endReason,
    overrideReason: row.overrideReason,
    overrideByUserId: row.overrideByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleFacilityVerticalRepAssignmentRepository
  implements FacilityVerticalRepAssignmentRepository
{
  async findOutOfTerritoryAssignments(params: {
    verticalIds?: number[];
    limit: number;
    offset: number;
  }): Promise<{
    rows: Array<{
      assignmentId: number;
      facilityId: number;
      facilityName: string;
      verticalId: number;
      userId: number;
      userName: string;
      overrideReason: string;
      overrideByUserId: number | null;
      overrideByName: string | null;
      startedAt: Date;
    }>;
    total: number;
  }> {
    // Spec 0009 R2: "how many out-of-territory assignments exist, who approved
    // them, why". Active overrides only — an ended one is history, not an
    // exposure. Vertical ids are bound as a string and parsed in SQL because the
    // driver cannot encode a JS array against an explicit cast.
    const verticalIdCsv = (params.verticalIds ?? [])
      .filter((id) => Number.isFinite(id))
      .join(",");

    const rows = (await db.execute(sql`
      WITH scope AS (
        SELECT COALESCE(
          string_to_array(NULLIF(${verticalIdCsv}, ''), ',')::bigint[],
          ARRAY[]::bigint[]
        ) AS vertical_ids
      )
      SELECT
        fvra.id AS assignment_id,
        f.id AS facility_id,
        f.name AS facility_name,
        fvp.vertical_id,
        fvra.user_id,
        COALESCE(u.first_name || ' ' || u.last_name, u.email, fvra.user_id::text) AS user_name,
        fvra.override_reason,
        fvra.override_by_user_id,
        COALESCE(ob.first_name || ' ' || ob.last_name, ob.email) AS override_by_name,
        fvra.started_at,
        count(*) OVER () AS total
      FROM facility_vertical_rep_assignments fvra
      INNER JOIN facility_vertical_profiles fvp
        ON fvp.id = fvra.facility_vertical_profile_id
      INNER JOIN facilities f ON f.id = fvp.facility_id
      INNER JOIN users u ON u.id = fvra.user_id
      LEFT JOIN users ob ON ob.id = fvra.override_by_user_id
      CROSS JOIN scope s
      WHERE fvra.ended_at IS NULL
        AND fvra.override_reason IS NOT NULL
        AND (cardinality(s.vertical_ids) = 0 OR fvp.vertical_id = ANY(s.vertical_ids))
      ORDER BY fvra.started_at DESC, fvra.id DESC
      LIMIT ${params.limit} OFFSET ${params.offset}
    `)) as Array<{
      assignment_id: string;
      facility_id: string;
      facility_name: string;
      vertical_id: string;
      user_id: string;
      user_name: string;
      override_reason: string;
      override_by_user_id: string | null;
      override_by_name: string | null;
      started_at: Date;
      total: string;
    }>;

    return {
      total: rows.length > 0 ? Number(rows[0]!.total) : 0,
      rows: rows.map((row) => ({
        assignmentId: Number(row.assignment_id),
        facilityId: Number(row.facility_id),
        facilityName: row.facility_name,
        verticalId: Number(row.vertical_id),
        userId: Number(row.user_id),
        userName: row.user_name,
        overrideReason: row.override_reason,
        overrideByUserId:
          row.override_by_user_id == null ? null : Number(row.override_by_user_id),
        overrideByName: row.override_by_name,
        startedAt: row.started_at,
      })),
    };
  }

  async findByFacilityVertical(
    facilityId: number,
    verticalId: number,
  ): Promise<FacilityVerticalRepAssignmentRecord[]> {
    const rows = await db
      .select({
        assignment: facilityVerticalRepAssignments,
        facilityId: facilityVerticalProfiles.facilityId,
        verticalId: facilityVerticalProfiles.verticalId,
      })
      .from(facilityVerticalRepAssignments)
      .innerJoin(
        facilityVerticalProfiles,
        eq(
          facilityVerticalProfiles.id,
          facilityVerticalRepAssignments.facilityVerticalProfileId,
        ),
      )
      .where(
        and(
          eq(facilityVerticalProfiles.facilityId, facilityId),
          eq(facilityVerticalProfiles.verticalId, verticalId),
        ),
      )
      .orderBy(desc(facilityVerticalRepAssignments.startedAt));

    return rows.map((row) =>
      mapAssignment(row.assignment, {
        facilityId: row.facilityId,
        verticalId: row.verticalId,
      }),
    );
  }

  async findCurrentByFacilityVertical(
    facilityId: number,
    verticalId: number,
  ): Promise<FacilityVerticalRepAssignmentRecord | null> {
    const [row] = await db
      .select({
        assignment: facilityVerticalRepAssignments,
        facilityId: facilityVerticalProfiles.facilityId,
        verticalId: facilityVerticalProfiles.verticalId,
      })
      .from(facilityVerticalRepAssignments)
      .innerJoin(
        facilityVerticalProfiles,
        eq(
          facilityVerticalProfiles.id,
          facilityVerticalRepAssignments.facilityVerticalProfileId,
        ),
      )
      .where(
        and(
          eq(facilityVerticalProfiles.facilityId, facilityId),
          eq(facilityVerticalProfiles.verticalId, verticalId),
          isNull(facilityVerticalRepAssignments.endedAt),
        ),
      )
      .orderBy(desc(facilityVerticalRepAssignments.startedAt))
      .limit(1);

    if (!row) return null;
    return mapAssignment(row.assignment, {
      facilityId: row.facilityId,
      verticalId: row.verticalId,
    });
  }

  async findActiveFacilityIdsByUserId(
    userId: number,
    verticalIds?: number[],
  ): Promise<number[]> {
    const conditions = [
      eq(facilityVerticalRepAssignments.userId, userId),
      isNull(facilityVerticalRepAssignments.endedAt),
      eq(facilityVerticalProfiles.isActive, true),
    ];
    if (verticalIds && verticalIds.length > 0) {
      conditions.push(inArray(facilityVerticalProfiles.verticalId, verticalIds));
    }

    const rows = await db
      .select({ facilityId: facilityVerticalProfiles.facilityId })
      .from(facilityVerticalRepAssignments)
      .innerJoin(
        facilityVerticalProfiles,
        eq(
          facilityVerticalProfiles.id,
          facilityVerticalRepAssignments.facilityVerticalProfileId,
        ),
      )
      .where(and(...conditions));

    return [...new Set(rows.map((row) => row.facilityId))];
  }

  async assign(params: {
    facilityId: number;
    verticalId: number;
    userId: number;
    assignedByUserId: number;
    overrideReason?: string | null;
    overrideByUserId?: number | null;
  }): Promise<{
    assignment: FacilityVerticalRepAssignmentRecord;
    previousUserId: number | null;
    wasIdempotent: boolean;
  }> {
    try {
      return await db.transaction(async (tx) => {
        const [existingProfile] = await tx
          .select()
          .from(facilityVerticalProfiles)
          .where(
            and(
              eq(facilityVerticalProfiles.facilityId, params.facilityId),
              eq(facilityVerticalProfiles.verticalId, params.verticalId),
            ),
          )
          .limit(1);

        let profile: ProfileRow;
        if (!existingProfile) {
          const [created] = await tx
            .insert(facilityVerticalProfiles)
            .values({
              facilityId: params.facilityId,
              verticalId: params.verticalId,
              isActive: true,
            })
            .returning();
          profile = created!;
        } else if (!existingProfile.isActive) {
          const [reactivated] = await tx
            .update(facilityVerticalProfiles)
            .set({ isActive: true, updatedAt: new Date() })
            .where(eq(facilityVerticalProfiles.id, existingProfile.id))
            .returning();
          profile = reactivated!;
        } else {
          profile = existingProfile;
        }

        const [current] = await tx
          .select()
          .from(facilityVerticalRepAssignments)
          .where(
            and(
              eq(
                facilityVerticalRepAssignments.facilityVerticalProfileId,
                profile.id,
              ),
              isNull(facilityVerticalRepAssignments.endedAt),
            ),
          )
          .limit(1);

        if (current && current.userId === params.userId) {
          return {
            assignment: mapAssignment(current, profile),
            previousUserId: null,
            wasIdempotent: true,
          };
        }

        let previousUserId: number | null = null;
        if (current) {
          previousUserId = current.userId;
          await tx
            .update(facilityVerticalRepAssignments)
            .set({
              endedAt: new Date(),
              endReason: "reassigned",
              // Spec 0009 R2/R5: who ended it, not only why.
              endedByUserId: params.assignedByUserId,
              updatedAt: new Date(),
            })
            .where(eq(facilityVerticalRepAssignments.id, current.id));
        }

        const [assignment] = await tx
          .insert(facilityVerticalRepAssignments)
          .values({
            facilityVerticalProfileId: profile.id,
            userId: params.userId,
            assignedByUserId: params.assignedByUserId,
            overrideReason: params.overrideReason ?? null,
            overrideByUserId: params.overrideByUserId ?? null,
          })
          .returning();

        return {
          assignment: mapAssignment(assignment!, profile),
          previousUserId,
          wasIdempotent: false,
        };
      });
    } catch (error) {
      if (isPostgresUniqueViolation(error)) {
        throw new ResourceConflictError(
          "FacilityVerticalRepAssignment",
          "concurrent reassignment; retry",
        );
      }
      throw error;
    }
  }

  async endActive(params: {
    facilityId: number;
    verticalId: number;
    endReason: string;
  }): Promise<{ endedUserId: number | null }> {
    const current = await this.findCurrentByFacilityVertical(
      params.facilityId,
      params.verticalId,
    );
    if (!current) return { endedUserId: null };

    await db
      .update(facilityVerticalRepAssignments)
      .set({
        endedAt: new Date(),
        endReason: params.endReason,
        updatedAt: new Date(),
      })
      .where(eq(facilityVerticalRepAssignments.id, current.id));

    return { endedUserId: current.userId };
  }

  async endActiveForProfiles(params: {
    facilityVerticalProfileIds: number[];
    endReason: string;
  }): Promise<number> {
    if (params.facilityVerticalProfileIds.length === 0) return 0;

    const updated = await db
      .update(facilityVerticalRepAssignments)
      .set({
        endedAt: new Date(),
        endReason: params.endReason,
        updatedAt: new Date(),
      })
      .where(
        and(
          inArray(
            facilityVerticalRepAssignments.facilityVerticalProfileId,
            params.facilityVerticalProfileIds,
          ),
          isNull(facilityVerticalRepAssignments.endedAt),
        ),
      )
      .returning({ id: facilityVerticalRepAssignments.id });

    return updated.length;
  }

  async deactivateVertical(params: {
    facilityId: number;
    verticalId: number;
  }): Promise<{ profileId: number | null; endedUserId: number | null }> {
    return db.transaction(async (tx) => {
      const [profile] = await tx
        .select()
        .from(facilityVerticalProfiles)
        .where(
          and(
            eq(facilityVerticalProfiles.facilityId, params.facilityId),
            eq(facilityVerticalProfiles.verticalId, params.verticalId),
          ),
        )
        .limit(1);

      if (!profile) {
        return { profileId: null, endedUserId: null };
      }

      const [current] = await tx
        .select()
        .from(facilityVerticalRepAssignments)
        .where(
          and(
            eq(
              facilityVerticalRepAssignments.facilityVerticalProfileId,
              profile.id,
            ),
            isNull(facilityVerticalRepAssignments.endedAt),
          ),
        )
        .limit(1);

      let endedUserId: number | null = null;
      if (current) {
        endedUserId = current.userId;
        await tx
          .update(facilityVerticalRepAssignments)
          .set({
            endedAt: new Date(),
            endReason: "vertical_deactivated",
            updatedAt: new Date(),
          })
          .where(eq(facilityVerticalRepAssignments.id, current.id));
      }

      if (profile.isActive) {
        await tx
          .update(facilityVerticalProfiles)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(facilityVerticalProfiles.id, profile.id));
      }

      return { profileId: profile.id, endedUserId };
    });
  }
}
