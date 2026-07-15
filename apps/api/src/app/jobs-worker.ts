import "dotenv/config";
import "./bootstrap-telemetry";
import { initializeBackgroundJobs } from "../infrastructure/jobs/init";
import { logger } from "../infrastructure/logging/logger";

async function start() {
  try {
    await initializeBackgroundJobs();
    logger.info("Jobs worker started");
  } catch (error) {
    logger.error("Failed to start jobs worker", error);
    process.exit(1);
  }
}

start();
