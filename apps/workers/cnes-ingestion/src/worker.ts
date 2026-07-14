import "./bootstrap-telemetry";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { NativeConnection, Worker } from "@temporalio/worker";
import * as activities from "./activities/index";
import { loadWorkerConfig } from "./config";
import { logger } from "./logger";

async function run() {
  const config = loadWorkerConfig();
  const connection = await NativeConnection.connect({
    address: config.temporalAddress,
  });

  const workflowsPath = join(dirname(fileURLToPath(import.meta.url)), "workflows");

  const worker = await Worker.create({
    connection,
    namespace: config.temporalNamespace,
    taskQueue: config.taskQueue,
    workflowsPath,
    activities,
  });

  logger.info("CNES ingestion worker started", {
    temporalAddress: config.temporalAddress,
    taskQueue: config.taskQueue,
  });

  await worker.run();
}

run().catch((error) => {
  logger.error("CNES ingestion worker failed", error);
  process.exit(1);
});
