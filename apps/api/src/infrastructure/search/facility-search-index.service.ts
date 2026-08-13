import { and, eq, isNull, sql } from "drizzle-orm";
import {
  facilities,
  facilityVerticalProfiles,
  facilityVerticalRepAssignments,
  municipalities,
  states,
} from "@atlasmed/database";
import {
  mapFacilitySearchDocument,
  type PurchaseFunnelStage,
  type PurchaseIntervalSource,
  type PurchaseProfile,
} from "@atlasmed/facility-insights";
import { db } from "../database/db";
import { logger } from "../logging/logger";
import { searchService } from "./search.service";

/**
 * Upsert one facility into Meili after create/update so name/address/geo
 * stay searchable without waiting for Temporal full rebuild / recurrence.
 * Document shape SoT: `@atlasmed/facility-insights` `mapFacilitySearchDocument`.
 */
export async function upsertFacilitySearchDocument(
  facilityId: number
): Promise<void> {
  if (!searchService.isConfigured()) return;

  try {
    const [row] = await db
      .select({
        id: facilities.id,
        displayName: facilities.displayName,
        legalName: facilities.legalName,
        tradeName: facilities.tradeName,
        legalDocument: facilities.legalDocument,
        cnesCode: facilities.cnesCode,
        city: municipalities.name,
        state: states.abbreviation,
        streetAddress: facilities.streetAddress,
        neighborhood: facilities.neighborhood,
        unitTypeId: facilities.unitTypeId,
        legalDocumentType: facilities.legalDocumentType,
        latitude: sql<number | null>`ST_Y(${facilities.location}::geometry)`,
        longitude: sql<number | null>`ST_X(${facilities.location}::geometry)`,
        deactivatedAt: facilities.deactivatedAt,
      })
      .from(facilities)
      .innerJoin(municipalities, eq(municipalities.id, facilities.municipalityId))
      .innerJoin(states, eq(states.id, facilities.stateId))
      .where(eq(facilities.id, facilityId))
      .limit(1);

    if (!row || row.deactivatedAt) {
      await searchService.deleteDocument("facilities", String(facilityId));
      return;
    }

    const profiles = await db
      .select({
        verticalId: facilityVerticalProfiles.verticalId,
        territoryId: facilityVerticalProfiles.managerZoneId,
        purchaseFunnelStage: facilityVerticalProfiles.purchaseFunnelStage,
        purchaseIntervalDays: facilityVerticalProfiles.purchaseIntervalDays,
        purchaseIntervalSource: facilityVerticalProfiles.purchaseIntervalSource,
        manualPurchaseProfile: facilityVerticalProfiles.manualPurchaseProfile,
        lastValidPurchaseDate: facilityVerticalProfiles.lastValidPurchaseDate,
      })
      .from(facilityVerticalProfiles)
      .where(
        and(
          eq(facilityVerticalProfiles.facilityId, facilityId),
          eq(facilityVerticalProfiles.isActive, true)
        )
      );

    const verticalIds = profiles.map((profile) => profile.verticalId);
    const territoryIds = [
      ...new Set(
        profiles.flatMap((profile) =>
          profile.territoryId ? [profile.territoryId] : []
        )
      ),
    ];

    const repRows =
      profiles.length === 0
        ? []
        : await db
            .select({
              userId: facilityVerticalRepAssignments.userId,
            })
            .from(facilityVerticalRepAssignments)
            .innerJoin(
              facilityVerticalProfiles,
              eq(
                facilityVerticalProfiles.id,
                facilityVerticalRepAssignments.facilityVerticalProfileId
              )
            )
            .where(
              and(
                eq(facilityVerticalProfiles.facilityId, facilityId),
                eq(facilityVerticalProfiles.isActive, true),
                isNull(facilityVerticalRepAssignments.endedAt)
              )
            );

    const document = mapFacilitySearchDocument({
      id: row.id,
      displayName: row.displayName,
      legalName: row.legalName,
      tradeName: row.tradeName,
      legalDocument: row.legalDocument,
      cnesCode: row.cnesCode,
      city: row.city,
      state: row.state,
      streetAddress: row.streetAddress ?? null,
      neighborhood: row.neighborhood ?? null,
      unitTypeId: row.unitTypeId,
      legalDocumentType: row.legalDocumentType,
      verticalIds,
      territoryIds,
      repUserIds: repRows.map((rep) => rep.userId),
      profileFunnelData: profiles.map((profile) => ({
        verticalId: profile.verticalId,
        purchaseFunnelStage: profile.purchaseFunnelStage as PurchaseFunnelStage,
        purchaseIntervalDays: profile.purchaseIntervalDays,
        purchaseIntervalSource:
          profile.purchaseIntervalSource as PurchaseIntervalSource,
        manualPurchaseProfile:
          profile.manualPurchaseProfile as PurchaseProfile | null,
        lastValidPurchaseDate:
          profile.lastValidPurchaseDate === null
            ? null
            : String(profile.lastValidPurchaseDate).slice(0, 10),
      })),
      latitude: row.latitude,
      longitude: row.longitude,
      deactivatedAt: row.deactivatedAt,
    });

    if (!document) {
      await searchService.deleteDocument("facilities", String(facilityId));
      return;
    }

    await searchService.updateDocuments("facilities", [document]);
  } catch (error) {
    // Search index lag is non-fatal — list path falls back to SQL.
    logger.warn("search.facility_upsert_failed", {
      facilityId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
