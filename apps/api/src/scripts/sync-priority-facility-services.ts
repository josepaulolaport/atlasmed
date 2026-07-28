/**
 * Upsert Ortopedia/Dermatologia service codes and link them to clinics
 * that have matching active vertical profiles.
 *
 *   bun run db:sync:priority-services
 */
import "dotenv/config";
import { db } from "../infrastructure/database/db";
import { syncPriorityFacilityServices } from "../modules/facility/application/services/priority-facility-services.sync";

async function main() {
  console.log("Syncing priority facility services (Ortopedia / Dermatologia)…");
  const result = await syncPriorityFacilityServices(db);
  console.log(
    `Done. services=${result.servicesUpserted} inserted_links=${result.linksInserted} removed_stale=${result.linksRemoved}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
