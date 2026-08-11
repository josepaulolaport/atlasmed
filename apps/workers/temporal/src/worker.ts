import "./bootstrap-telemetry";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { NativeConnection, Worker } from "@temporalio/worker";
import { Client, Connection } from "@temporalio/client";
import { assertStorageConfig } from "@atlasmed/config";
import * as activities from "./activities/index";
import { loadWorkerConfig, type WorkerConfig } from "./config";
import { logger } from "./logger";
import { closeEmultecMysqlPool } from "./emultec/emultec-mysql";
import { ensurePurchaseRecurrenceSchedules } from "./scripts/ensure-purchase-recurrence-schedule";
import { ensureEmultecOrderImportSchedules } from "./scripts/ensure-emultec-order-import-schedule";
import { ensureCadastroSweepSchedule } from "./scripts/ensure-cadastro-sweep-schedule";

/** Idempotent — safe to run on every boot. Logs and continues on failure so a
 * transient Temporal hiccup never blocks the worker from picking up tasks. */
async function ensureSchedules(config: WorkerConfig): Promise<void> {
  const connection = await Connection.connect({ address: config.temporalAddress });
  try {
    const client = new Client({ connection, namespace: config.temporalNamespace });
    await Promise.all([
      ensurePurchaseRecurrenceSchedules(client.schedule, { taskQueue: config.taskQueue }),
      ensureEmultecOrderImportSchedules(client.schedule, { taskQueue: config.taskQueue }),
      ensureCadastroSweepSchedule(client.schedule, { taskQueue: config.taskQueue }),
    ]);
  } catch (error) {
    logger.error("AtlasMed Temporal worker schedule provisioning failed", error);
  } finally {
    await connection.close();
  }
}

async function run() {
  const config = loadWorkerConfig();

  // Fail before picking up any task. The cadastro file-processing activity
  // signs S3 requests with these values; an empty endpoint used to send them,
  // silently, to real Amazon S3. There is no useful degraded mode — a worker
  // that leases file-processing tasks it cannot perform just fails them.
  assertStorageConfig();

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

  try {
    await worker.run();
  } finally {
    // Emultec is someone else's database — leave it a clean FIN rather than
    // sockets its server has to time out. `worker.run()` returns on shutdown.
    await closeEmultecMysqlPool();
  }
}

run().catch((error) => {
  logger.error("AtlasMed Temporal worker failed", error);
  process.exit(1);
});
