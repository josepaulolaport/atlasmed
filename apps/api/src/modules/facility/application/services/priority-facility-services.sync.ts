import { randomUUID } from "node:crypto";
import {
  businessVerticals,
  facilityServices,
  facilityVerticalProfiles,
  services as cnesServices,
  type Database,
} from "@atlasmed/database";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  PRIORITY_FACILITY_SERVICE_CLASSIFICATION,
  PRIORITY_FACILITY_SERVICE_SOURCE,
  PRIORITY_FACILITY_SERVICES,
} from "../constants/priority-facility-services";

export type PriorityFacilityServicesSyncResult = {
  servicesUpserted: number;
  linksInserted: number;
  linksRemoved: number;
};

/**
 * Ensure Ortopedia/Dermatologia service catalog rows exist and every active
 * vertical profile clinic has the matching specialty link.
 */
export async function syncPriorityFacilityServices(
  db: Database,
): Promise<PriorityFacilityServicesSyncResult> {
  const now = new Date();
  let servicesUpserted = 0;

  for (const row of PRIORITY_FACILITY_SERVICES) {
    const inserted = await db
      .insert(cnesServices)
      .values({
        serviceCode: row.serviceCode,
        serviceName: row.serviceName,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: cnesServices.serviceCode,
        set: {
          serviceName: row.serviceName,
          updatedAt: now,
        },
      })
      .returning({ serviceCode: cnesServices.serviceCode });
    servicesUpserted += inserted.length;
  }

  const verticalCodes = PRIORITY_FACILITY_SERVICES.map((row) => row.verticalCode);
  const verticalRows = await db
    .select({
      id: businessVerticals.id,
      code: businessVerticals.code,
    })
    .from(businessVerticals)
    .where(inArray(businessVerticals.code, [...verticalCodes]));

  const verticalIdByCode = new Map(
    verticalRows.map((row) => [row.code, row.id] as const),
  );

  let linksInserted = 0;
  for (const row of PRIORITY_FACILITY_SERVICES) {
    const verticalId = verticalIdByCode.get(row.verticalCode);
    if (!verticalId) continue;

    const facilityRows = await db
      .select({ facilityId: facilityVerticalProfiles.facilityId })
      .from(facilityVerticalProfiles)
      .where(
        and(
          eq(facilityVerticalProfiles.verticalId, verticalId),
          eq(facilityVerticalProfiles.isActive, true),
        ),
      );

    const BATCH = 500;
    for (let i = 0; i < facilityRows.length; i += BATCH) {
      const batch = facilityRows.slice(i, i + BATCH);
      if (batch.length === 0) continue;

      const values = batch.map((facility) => ({
        id: randomUUID(),
        facilityId: facility.facilityId,
        serviceCode: row.serviceCode,
        classificationCode: PRIORITY_FACILITY_SERVICE_CLASSIFICATION,
        sourceProvider: PRIORITY_FACILITY_SERVICE_SOURCE,
        sourceFirstSeenAt: now,
        sourceLastSeenAt: now,
        createdAt: now,
        updatedAt: now,
      }));

      const inserted = await db
        .insert(facilityServices)
        .values(values)
        .onConflictDoNothing()
        .returning({ id: facilityServices.id });
      linksInserted += inserted.length;

      await db
        .update(facilityServices)
        .set({
          sourceLastSeenAt: now,
          updatedAt: now,
          sourceProvider: PRIORITY_FACILITY_SERVICE_SOURCE,
        })
        .where(
          and(
            inArray(
              facilityServices.facilityId,
              batch.map((facility) => facility.facilityId),
            ),
            eq(facilityServices.serviceCode, row.serviceCode),
            eq(
              facilityServices.classificationCode,
              PRIORITY_FACILITY_SERVICE_CLASSIFICATION,
            ),
          ),
        );
    }
  }

  const deleteResult = await db.execute(sql`
    DELETE FROM facility_services fs
    WHERE fs.source_provider = ${PRIORITY_FACILITY_SERVICE_SOURCE}
      AND fs.service_code IN (
        ${PRIORITY_FACILITY_SERVICES[0].serviceCode},
        ${PRIORITY_FACILITY_SERVICES[1].serviceCode}
      )
      AND NOT EXISTS (
        SELECT 1
        FROM facility_vertical_profiles fvp
        JOIN business_verticals bv ON bv.id = fvp.vertical_id
        WHERE fvp.facility_id = fs.facility_id
          AND fvp.is_active = true
          AND (
            (fs.service_code = ${PRIORITY_FACILITY_SERVICES[0].serviceCode}
              AND bv.code = ${PRIORITY_FACILITY_SERVICES[0].verticalCode})
            OR
            (fs.service_code = ${PRIORITY_FACILITY_SERVICES[1].serviceCode}
              AND bv.code = ${PRIORITY_FACILITY_SERVICES[1].verticalCode})
          )
      )
  `);

  const linksRemoved = Number(
    (deleteResult as { rowCount?: number }).rowCount ?? 0,
  );

  return { servicesUpserted, linksInserted, linksRemoved };
}
