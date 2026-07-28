/**
 * Seed Orto / Estética potential metric definitions.
 *
 *   bun run db:seed:potential-definitions
 */
import { businessVerticals, potentialMetricDefinitions } from "@atlasmed/database";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../infrastructure/database/db";

const SEEDS: Array<{
  verticalCode: string;
  key: string;
  label: string;
  sortOrder: number;
}> = [
  {
    verticalCode: "ORTOPEDIA",
    key: "ampolas_mes",
    label: "Ampolas/mês",
    sortOrder: 0,
  },
  {
    verticalCode: "DERMATOLOGIA",
    key: "prp",
    label: "PRP",
    sortOrder: 0,
  },
  {
    verticalCode: "DERMATOLOGIA",
    key: "preenchedor_facial",
    label: "Preenchedor facial",
    sortOrder: 1,
  },
  {
    verticalCode: "DERMATOLOGIA",
    key: "preenchedor_corporal",
    label: "Preenchedor corporal",
    sortOrder: 2,
  },
  {
    verticalCode: "DERMATOLOGIA",
    key: "bioestimulador",
    label: "Bioestimulador",
    sortOrder: 3,
  },
];

async function main() {
  console.log("🌱 Seeding potential metric definitions…");

  for (const seed of SEEDS) {
    const [vertical] = await db
      .select({ id: businessVerticals.id, name: businessVerticals.name })
      .from(businessVerticals)
      .where(eq(businessVerticals.code, seed.verticalCode))
      .limit(1);

    if (!vertical) {
      console.warn(`  skip ${seed.key}: vertical ${seed.verticalCode} missing`);
      continue;
    }

    const [existing] = await db
      .select({ id: potentialMetricDefinitions.id })
      .from(potentialMetricDefinitions)
      .where(
        and(
          eq(potentialMetricDefinitions.verticalId, vertical.id),
          eq(potentialMetricDefinitions.key, seed.key),
          isNull(potentialMetricDefinitions.deletedAt),
        ),
      )
      .limit(1);

    if (existing) {
      await db
        .update(potentialMetricDefinitions)
        .set({
          label: seed.label,
          sortOrder: seed.sortOrder,
          updatedAt: new Date(),
        })
        .where(eq(potentialMetricDefinitions.id, existing.id));
      console.log(`  update ${vertical.name}/${seed.key}`);
      continue;
    }

    await db.insert(potentialMetricDefinitions).values({
      verticalId: vertical.id,
      key: seed.key,
      label: seed.label,
      sortOrder: seed.sortOrder,
    });
    console.log(`  insert ${vertical.name}/${seed.key}`);
  }

  console.log("✅ Potential definitions ready");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
