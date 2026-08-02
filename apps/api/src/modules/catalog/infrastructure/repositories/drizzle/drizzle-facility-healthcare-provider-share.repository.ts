import { db } from "../../../../../infrastructure/database/db";
import { facilityHealthcareProviderShares, healthcareProviders } from "@atlasmed/database";
import { eq, sql } from "drizzle-orm";
import type {
  FacilityHealthcareProviderShareRecord,
  FacilityHealthcareProviderShareRepository,
} from "../../../application/interfaces/facility-healthcare-provider-share.repository.interface";

/** Imported rows may store values like `"20%"`; API/manual writes store `"20"`. */
function parseSharePercent(value: string): number {
  const cleaned = value.trim().replace(/%/g, "").replace(",", ".");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatSharePercent(value: number): string {
  return String(value);
}

/** Cast text share_percent to numeric, tolerating a trailing `%`. */
const sharePercentNumeric = sql`replace(${facilityHealthcareProviderShares.sharePercent}, '%', '')::numeric`;

function mapShare(row: {
  id: string;
  facilityId: string;
  healthcareProviderId: string;
  sharePercent: string;
  isPackage: boolean;
  source: "MANUAL" | "REGISTRY" | "IMPORT";
  createdAt: Date;
  updatedAt: Date;
  healthcareProvider: { id: string; name: string; type: string };
}): FacilityHealthcareProviderShareRecord {
  return {
    id: row.id,
    facilityId: row.facilityId,
    healthcareProviderId: row.healthcareProviderId,
    sharePercent: parseSharePercent(row.sharePercent),
    isPackage: row.isPackage,
    source: row.source,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    healthcareProvider: row.healthcareProvider,
  };
}

const shareSelect = {
  id: facilityHealthcareProviderShares.id,
  facilityId: facilityHealthcareProviderShares.facilityId,
  healthcareProviderId: facilityHealthcareProviderShares.healthcareProviderId,
  sharePercent: facilityHealthcareProviderShares.sharePercent,
  isPackage: facilityHealthcareProviderShares.isPackage,
  source: facilityHealthcareProviderShares.source,
  createdAt: facilityHealthcareProviderShares.createdAt,
  updatedAt: facilityHealthcareProviderShares.updatedAt,
  healthcareProvider: {
    id: healthcareProviders.id,
    name: healthcareProviders.name,
    type: healthcareProviders.type,
  },
};

export class DrizzleFacilityHealthcareProviderShareRepository
  implements FacilityHealthcareProviderShareRepository
{
  async findByFacility(facilityId: string): Promise<FacilityHealthcareProviderShareRecord[]> {
    const rows = await db
      .select(shareSelect)
      .from(facilityHealthcareProviderShares)
      .innerJoin(
        healthcareProviders,
        eq(facilityHealthcareProviderShares.healthcareProviderId, healthcareProviders.id)
      )
      .where(eq(facilityHealthcareProviderShares.facilityId, facilityId))
      .orderBy(sql`${sharePercentNumeric} desc`);

    return rows.map(mapShare);
  }

  async create(data: {
    facilityId: string;
    healthcareProviderId: string;
    sharePercent: number;
    isPackage?: boolean;
  }): Promise<FacilityHealthcareProviderShareRecord> {
    const [share] = await db
      .insert(facilityHealthcareProviderShares)
      .values({
        facilityId: data.facilityId,
        healthcareProviderId: data.healthcareProviderId,
        sharePercent: formatSharePercent(data.sharePercent),
        isPackage: data.isPackage ?? false,
        source: "MANUAL",
      })
      .returning({ id: facilityHealthcareProviderShares.id });

    const [row] = await db
      .select(shareSelect)
      .from(facilityHealthcareProviderShares)
      .innerJoin(
        healthcareProviders,
        eq(facilityHealthcareProviderShares.healthcareProviderId, healthcareProviders.id)
      )
      .where(eq(facilityHealthcareProviderShares.id, share!.id));

    return mapShare(row!);
  }

  async replaceByFacility(
    facilityId: string,
    shares: Array<{
      healthcareProviderId: string;
      sharePercent: number;
      isPackage?: boolean;
    }>
  ): Promise<FacilityHealthcareProviderShareRecord[]> {
    await db.transaction(async (tx) => {
      await tx
        .delete(facilityHealthcareProviderShares)
        .where(eq(facilityHealthcareProviderShares.facilityId, facilityId));

      if (shares.length === 0) {
        return;
      }

      await tx.insert(facilityHealthcareProviderShares).values(
        shares.map((share) => ({
          facilityId,
          healthcareProviderId: share.healthcareProviderId,
          sharePercent: formatSharePercent(share.sharePercent),
          isPackage: share.isPackage ?? false,
          source: "MANUAL" as const,
          manuallyEditedAt: new Date(),
        }))
      );
    });

    return this.findByFacility(facilityId);
  }

  async sumSharePercentForFacility(facilityId: string): Promise<number> {
    const [result] = await db
      .select({ sum: sql<string>`sum(${sharePercentNumeric})` })
      .from(facilityHealthcareProviderShares)
      .where(eq(facilityHealthcareProviderShares.facilityId, facilityId));

    return Number(result?.sum ?? 0);
  }
}
