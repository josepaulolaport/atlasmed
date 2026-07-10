import "dotenv/config";
import "./bootstrap-telemetry";
import app from "./app";
import { initializeBackgroundJobs } from "../infrastructure/jobs/init";
import { logger } from "../infrastructure/logging/logger";

const port = process.env.PORT || 3000;

async function start() {
  try {
    await initializeBackgroundJobs();

    app.listen(port, () => {
      logger.info("Server started", {
        port: Number(port),
        healthUrl: `http://localhost:${port}/health`,
        metricsUrl: `http://localhost:${port}/health/metrics`,
      });
    });
  } catch (error) {
    logger.error("Failed to start server", error);
    process.exit(1);
  }
}

start();
