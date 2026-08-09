import "./bootstrap-telemetry";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { NativeConnection, Worker } from "@temporalio/worker";
import { Client, Connection } from "@temporalio/client";
import * as activities from "./activities/index";
import { loadWorkerConfig, type WorkerConfig } from "./config";
import { logger } from "./logger";
import { ensurePurchaseRecurrenceSchedules } from "./scripts/ensure-purchase-recurrence-schedule";
import { ensureEmultecOrderImportSchedules } from "./scripts/ensure-emultec-order-import-schedule";

/** Idempotent — safe to run on every boot. Logs and continues on failure so a
 * transient Temporal hiccup never blocks the worker from picking up tasks. */
async function ensureSchedules(config: WorkerConfig): Promise<void> {
  const connection = await Connection.connect({ address: config.temporalAddress });
  try {
    const client = new Client({ connection, namespace: config.temporalNamespace });
    await Promise.all([
      ensurePurchaseRecurrenceSchedules(client.schedule, { taskQueue: config.taskQueue }),
      ensureEmultecOrderImportSchedules(client.schedule, { taskQueue: config.taskQueue }),
    ]);
  } catch (error) {
    logger.error("AtlasMed Temporal worker schedule provisioning failed", error);
  } finally {
    await connection.close();
  }
}

async function run() {
  const config = loadWorkerConfig();

  await ensureSchedules(config);

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

  logger.info("AtlasMed Temporal worker started", {
    temporalAddress: config.temporalAddress,
    taskQueue: config.taskQueue,
  });

  await worker.run();
}

run().catch((error) => {
  logger.error("AtlasMed Temporal worker failed", error);
  process.exit(1);
});
