import "dotenv/config";
import { prisma } from "../infrastructure/database/prisma.client";
import { PrismaTerritorySpatialRepository } from "../modules/territory/infrastructure/repositories/prisma/prisma-territory-spatial.repository";

const spatialRepository = new PrismaTerritorySpatialRepository();

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const patches = await prisma.territory.findMany({
    where: {
      isActive: true,
      territoryType: { assignsClinics: true },
    },
    select: {
      id: true,
      code: true,
      countryCode: true,
      managerTerritoryId: true,
    },
  });

  let updated = 0;
  let unresolved = 0;

  for (const patch of patches) {
    const boundary = await spatialRepository.getBoundaryAsGeoJson(patch.id);
    if (!boundary) {
      unresolved += 1;
      console.warn(`skip ${patch.code}: missing boundary geometry`);
      continue;
    }

    const zones = await spatialRepository.findContainingManagerZones({
      geoJson: boundary,
      countryCode: patch.countryCode ?? "BR",
    });

    if (zones.length !== 1) {
      unresolved += 1;
      console.warn(
        `unresolved ${patch.code}: expected 1 manager zone, found ${zones.length}`
      );
      continue;
    }

    const managerTerritoryId = zones[0]!.id;
    if (patch.managerTerritoryId === managerTerritoryId) {
      continue;
    }

    if (!dryRun) {
      await prisma.territory.update({
        where: { id: patch.id },
        data: { managerTerritoryId },
      });
    }

    updated += 1;
    console.log(
      `${dryRun ? "[dry-run] " : ""}${patch.code} -> manager zone ${zones[0]!.code}`
    );
  }

  console.log(
    JSON.stringify({ patches: patches.length, updated, unresolved, dryRun }, null, 2)
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
