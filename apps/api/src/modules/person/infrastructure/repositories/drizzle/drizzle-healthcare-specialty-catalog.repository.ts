import { healthcareSpecialties } from "@atlasmed/database";
import { asc, eq } from "drizzle-orm";
import { db } from "../../../../../infrastructure/database/db";
import type {
  HealthcareSpecialtyCatalogEntry,
  HealthcareSpecialtyCatalogRepository,
} from "../../../application/use-cases/list-healthcare-specialty-catalog.use-case";

export class DrizzleHealthcareSpecialtyCatalogRepository
  implements HealthcareSpecialtyCatalogRepository
{
  async listActive(): Promise<HealthcareSpecialtyCatalogEntry[]> {
    return db
      .select({ id: healthcareSpecialties.id, name: healthcareSpecialties.name })
      .from(healthcareSpecialties)
      .where(eq(healthcareSpecialties.isActive, true))
      .orderBy(asc(healthcareSpecialties.name));
  }
}
