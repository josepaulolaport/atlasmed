import { cleanupJobs, startCleanupWorker } from "./cleanup.jobs";
import { startNotificationWorker } from "./notification.queue";
import { logger } from "../logging/logger";
import { registerTerritoryMembershipWorker } from "../../modules/territory/composition";

export async function initializeBackgroundJobs(): Promise<void> {
  try {
    logger.info("Initializing background jobs");

    startNotificationWorker();
    startCleanupWorker();
    registerTerritoryMembershipWorker();
    await cleanupJobs.initializeAllJobs();

    logger.info("Background jobs initialized");
  } catch (error) {
    logger.error("Failed to initialize background jobs", error);
    throw error;
  }
}
