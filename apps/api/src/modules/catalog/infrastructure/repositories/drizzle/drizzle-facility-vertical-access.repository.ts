import { and, eq } from "drizzle-orm";
import { businessVerticals, facilityVerticalProfiles } from "@atlasmed/database";
import { db } from "../../../../../infrastructure/database/db";
import type { FacilityVerticalAccessRepository } from "../../../application/interfaces/facility-vertical-access.repository.interface";

export class DrizzleFacilityVerticalAccessRepository
  implements FacilityVerticalAccessRepository
{
  async findVerticalIdByCode(code: string): Promise<string | null> {
    const [row] = await db
      .select({ id: businessVerticals.id })
      .from(businessVerticals)
      .where(eq(businessVerticals.code, code))
      .limit(1);
    return row?.id ?? null;
  }

  async hasActiveVerticalProfile(
    facilityId: string,
    verticalId: string
  ): Promise<boolean> {
    const [row] = await db
      .select({ id: facilityVerticalProfiles.id })
      .from(facilityVerticalProfiles)
      .where(
        and(
          eq(facilityVerticalProfiles.facilityId, facilityId),
          eq(facilityVerticalProfiles.verticalId, verticalId),
          eq(facilityVerticalProfiles.isActive, true)
        )
      )
      .limit(1);
    return Boolean(row);
  }
}
