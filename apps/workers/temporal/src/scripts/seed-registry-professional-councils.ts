import { registryProfessionalCouncils } from "@atlasmed/database";
import { sql } from "drizzle-orm";
import { db } from "../infrastructure/db";
import { logger } from "../logger";

/**
 * Seeds `registry.professional_councils` from our own curated council table.
 *
 * ADR 0009 §6: the loader reads its council whitelist from this table and
 * refuses to run while it is empty, because the CNES export ships two
 * disagreeing code systems — CRM is `10` in `tbConselhoClasse` and `71` in the
 * órgão-emissor codes `tbCargaHorariaSus` actually uses. Seeding from the
 * export would mislabel every doctor's council.
 *
 * `person_professional_registration_councils.cnes_id` is the curated answer to
 * that ambiguity and already carries 71 for CRM, so the whitelist is a
 * projection of data we own rather than a judgement call made here. The same
 * row supplies `atlasmed_id`, which is how a registry council resolves back to
 * one of ours.
 *
 * Idempotent: re-running refreshes the names, abbreviations and active flags of
 * councils already seeded, and never deletes. A council retired on our side
 * goes inactive here rather than disappearing, because registrations already
 * imported still point at it.
 *
 *   bun src/scripts/seed-registry-professional-councils.ts
 */
export async function seedRegistryProfessionalCouncils(): Promise<number> {
  const rows = await db.execute<{
    id: string;
    name: string;
    abbreviation: string;
    cnes_id: string;
    is_active: boolean;
  }>(sql`
    select id, name, abbreviation, cnes_id, is_active
    from person_professional_registration_councils
    where cnes_id is not null
    order by cnes_id
  `);

  const councils = Array.from(rows).map((row) => ({
    cnesId: row.cnes_id,
    name: row.name,
    abbreviation: row.abbreviation,
    atlasmedId: Number(row.id),
    isActive: row.is_active,
  }));

  if (councils.length === 0) {
    throw new Error(
      "person_professional_registration_councils has no rows carrying a cnes_id — " +
        "nothing to seed, and the CNES loader would still refuse to run."
    );
  }

  await db
    .insert(registryProfessionalCouncils)
    .values(councils)
    .onConflictDoUpdate({
      target: registryProfessionalCouncils.cnesId,
      set: {
        name: sql`excluded.name`,
        abbreviation: sql`excluded.abbreviation`,
        atlasmedId: sql`excluded.atlasmed_id`,
        isActive: sql`excluded.is_active`,
      },
    });

  logger.info("cnes.registry.councils_seeded", {
    count: councils.length,
    abbreviations: councils.map((c) => c.abbreviation).join(","),
  });
  return councils.length;
}

if (import.meta.main) {
  const seeded = await seedRegistryProfessionalCouncils();
  console.log(`seeded ${seeded} councils into registry.professional_councils`);
  process.exit(0);
}
