import { cleanupJobs, startCleanupWorker } from "./cleanup.jobs";
import { startNotificationWorker } from "./notification.queue";
import { logger } from "../logging/logger";
import { registerTerritoryMembershipWorker } from "../../modules/territory/composition";
import { interactionOverdueJobs, startInteractionOverdueWorker } from "../../modules/interactions/infrastructure/jobs/interaction-overdue.jobs";

export async function initializeBackgroundJobs(): Promise<void> {
  try {
    logger.info("Initializing background jobs");

    startNotificationWorker();
    startCleanupWorker();
    registerTerritoryMembershipWorker();
    startInteractionOverdueWorker();
    await Promise.all([cleanupJobs.initializeAllJobs(), interactionOverdueJobs.schedule()]);

    logger.info("Background jobs initialized");
  } catch (error) {
    logger.error("Failed to initialize background jobs", error);
    throw error;
  }
}
