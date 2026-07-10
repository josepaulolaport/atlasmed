import { cleanupJobs } from "./cleanup.jobs";
import { logger } from "../logging/logger";

export async function initializeBackgroundJobs(): Promise<void> {
  try {
    logger.info("Initializing background jobs");

    await cleanupJobs.initializeAllJobs();

    logger.info("Background jobs initialized");
  } catch (error) {
    logger.error("Failed to initialize background jobs", error);
    throw error;
  }
}
