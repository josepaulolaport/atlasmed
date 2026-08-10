import { db } from "../../../../infrastructure/database/db";
import {
  facilityVerticalRepAssignments,
  territories,
  territoryTypes,
} from "@atlasmed/database";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { OperationNotAllowedError } from "../../../../shared/errors";
import { REP_PATCH_TYPE_SLUG } from "../../application/constants/territory-roles.constants";
import type {
  BoundaryCommitCommand,
  BoundaryCommitResult,
  TerritoryBoundaryWriter,
} from "../../application/interfaces/territory-boundary.writer.interface";

/**
 * Spec 0009 R1: ending rep assignments and rewriting the boundary happen in one
 * transaction, so a geometry rejected by PostGIS rolls the de-assignments back.
 */
export class DrizzleTerritoryBoundaryWriter implements TerritoryBoundaryWriter {
  async commitBoundaryChange(
    command: BoundaryCommitCommand
  ): Promise<BoundaryCommitResult> {
    if (command.boundary.type !== "Polygon" && command.boundary.type !== "MultiPolygon") {
      throw new OperationNotAllowedError(
        "save_boundary",
        "Boundary must be a GeoJSON Polygon or MultiPolygon"
      );
    }

    const geoJsonString = JSON.stringify(command.boundary);

    return db.transaction(async (tx) => {
      let endedAssignmentCount = 0;

      if (command.endAssignmentsForProfileIds.length > 0) {
        const ended = await tx
          .update(facilityVerticalRepAssignments)
          .set({
            endedAt: new Date(),
            endReason: command.endReason,
            updatedAt: new Date(),
          })
          .where(
            and(
              inArray(
                facilityVerticalRepAssignments.facilityVerticalProfileId,
                command.endAssignmentsForProfileIds
              ),
              isNull(facilityVerticalRepAssignments.endedAt)
            )
          )
          .returning({ id: facilityVerticalRepAssignments.id });

        endedAssignmentCount = ended.length;
      }

      const validation = (await tx.execute(sql`
        SELECT
          ST_IsValid(ST_SetSRID(ST_GeomFromGeoJSON(${geoJsonString}), 4326)) AS is_valid,
          ST_IsValidReason(ST_SetSRID(ST_GeomFromGeoJSON(${geoJsonString}), 4326)) AS reason
      `)) as Array<{ is_valid: boolean; reason: string | null }>;

      if (!validation[0]?.is_valid) {
        if (!command.repairInvalid) {
          // Rolls back the de-assignments above.
          throw new OperationNotAllowedError(
            "save_boundary",
            validation[0]?.reason ?? "Invalid geometry"
          );
        }

        await tx.execute(sql`
          UPDATE territories
          SET boundary = ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(${geoJsonString}), 4326)),
              updated_at = NOW()
          WHERE id = ${command.territoryId}
        `);
      } else {
        await tx.execute(sql`
          UPDATE territories
          SET boundary = ST_SetSRID(ST_GeomFromGeoJSON(${geoJsonString}), 4326),
              updated_at = NOW()
          WHERE id = ${command.territoryId}
        `);
      }

      if (command.managerTerritoryId !== undefined) {
        await tx
          .update(territories)
          .set({
            managerTerritoryId: command.managerTerritoryId,
            updatedAt: new Date(),
          })
          .where(eq(territories.id, command.territoryId));
      }

      let repPatchCount: number | null = null;
      if (command.countRepPatches) {
        const [result] = await tx
          .select({ count: sql<number>`count(*)` })
          .from(territories)
          .innerJoin(territoryTypes, eq(territories.territoryTypeId, territoryTypes.id))
          .where(
            and(
              eq(territories.managerTerritoryId, command.territoryId),
              eq(territories.isActive, true),
              eq(territoryTypes.slug, REP_PATCH_TYPE_SLUG)
            )
          );
        repPatchCount = Number(result?.count ?? 0);
      }

      return { endedAssignmentCount, repPatchCount };
    });
  }
}
