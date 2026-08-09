import { personProfessionalRegistrationCouncils } from "@atlasmed/database";
import { and, asc, eq } from "drizzle-orm";
import { db } from "../../../../../infrastructure/database/db";
import type {
  PersonProfessionalRegistrationCouncilEntry,
  PersonProfessionalRegistrationCouncilRepository,
} from "../../../application/interfaces/person-professional-registration-council.repository.interface";

export class DrizzlePersonProfessionalRegistrationCouncilRepository
  implements PersonProfessionalRegistrationCouncilRepository
{
  async listActive(): Promise<PersonProfessionalRegistrationCouncilEntry[]> {
    return db
      .select({
        id: personProfessionalRegistrationCouncils.id,
        name: personProfessionalRegistrationCouncils.name,
        abbreviation: personProfessionalRegistrationCouncils.abbreviation,
        isActive: personProfessionalRegistrationCouncils.isActive,
      })
      .from(personProfessionalRegistrationCouncils)
      .where(eq(personProfessionalRegistrationCouncils.isActive, true))
      .orderBy(asc(personProfessionalRegistrationCouncils.abbreviation));
  }

  async findActiveById(
    councilId: number
  ): Promise<PersonProfessionalRegistrationCouncilEntry | null> {
    const [row] = await db
      .select({
        id: personProfessionalRegistrationCouncils.id,
        name: personProfessionalRegistrationCouncils.name,
        abbreviation: personProfessionalRegistrationCouncils.abbreviation,
        isActive: personProfessionalRegistrationCouncils.isActive,
      })
      .from(personProfessionalRegistrationCouncils)
      .where(
        and(
          eq(personProfessionalRegistrationCouncils.id, councilId),
          eq(personProfessionalRegistrationCouncils.isActive, true)
        )
      )
      .limit(1);
    return row ?? null;
  }
}
