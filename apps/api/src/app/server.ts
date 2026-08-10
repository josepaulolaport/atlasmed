import "dotenv/config";
import "./bootstrap-telemetry";
import app from "./app";
import { environment } from "./config/environment";
import { logger } from "../infrastructure/logging/logger";
import { ensureStorageBuckets } from "../infrastructure/storage/bucket-provisioning";
import { assertStorageConfigured } from "../infrastructure/storage/storage.client";

const port = environment.PORT;

async function start() {
  try {
    // Misconfiguration is fatal: better a loud boot failure than presigned URLs
    // built from a cluster-internal hostname that no phone can reach.
    assertStorageConfigured();
    // Reachability is not: a store that is merely slow to come up must not
    // crash-loop the API.
    await ensureStorageBuckets();

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
