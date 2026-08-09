import { personFacilityRoles } from "@atlasmed/database";
import { asc, eq } from "drizzle-orm";
import { db } from "../../../../../infrastructure/database/db";
import type {
  PersonFacilityRoleCatalogEntry,
  PersonFacilityRoleCatalogRepository,
} from "../../../application/interfaces/person-facility-role-catalog.repository.interface";

export class DrizzlePersonFacilityRoleCatalogRepository
  implements PersonFacilityRoleCatalogRepository
{
  async listActive(): Promise<PersonFacilityRoleCatalogEntry[]> {
    const rows = await db
      .select({
        id: personFacilityRoles.id,
        name: personFacilityRoles.name,
        isActive: personFacilityRoles.isActive,
      })
      .from(personFacilityRoles)
      .where(eq(personFacilityRoles.isActive, true))
      .orderBy(asc(personFacilityRoles.name));

    return rows;
  }
}
