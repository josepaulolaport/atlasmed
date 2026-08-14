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
import { ensureMetricSnapshotSchedules } from "./scripts/ensure-metric-snapshot-schedule";
import { ensureCnesIngestionSchedule } from "./scripts/ensure-cnes-ingestion-schedule";

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
      ensureMetricSnapshotSchedules(client.schedule, { taskQueue: config.taskQueue }),
      ensureCnesIngestionSchedule(client.schedule, { taskQueue: config.taskQueue }),
    ]);
  } catch (error) {
    logger.error("AtlasMed Temporal worker schedule provisioning failed", error);
  } finally {
    await connection.close();
  }
}

/**
 * What this worker is allowed to run at once.
 *
 * The SDK's defaults are sized for many small activities: **100** concurrent
 * activity executions, 100 local ones, and a workflow cache derived from heap.
 * This worker's activities are the opposite shape — few, long, and heavy. The
 * CNES ingest alone peaks at ~220 MB RSS and runs for minutes; a search rebuild
 * holds a 20 000-document page. A hundred of those at once would exhaust the
 * machine, and on a developer's laptop it shares that machine with Postgres,
 * four Meilisearch instances and Docker's own ceiling.
 *
 * That has never happened, and the reason is worth stating because it is *not* a
 * limit: every schedule uses `ScheduleOverlapPolicy.SKIP`, and no workflow fans
 * activities out — they run in sequence. So real demand is at most one activity
 * per schedule, five of them. The safety comes entirely from workflow design.
 *
 * Which is exactly why the ceiling belongs here. The next workflow to reach for
 * `Promise.all` would inherit 100-way concurrency silently, and the failure
 * would arrive as a wedged laptop rather than as a queue that waits.
 *
 * Eight leaves headroom over the five schedules while bounding the worst case at
 * something the machine survives. Raise it when an activity is genuinely small
 * and genuinely parallel, not by default.
 */
const CONCURRENCY = {
  maxConcurrentActivityTaskExecutions: 8,
  maxConcurrentLocalActivityExecutions: 8,
  /** Workflow tasks are cheap — they only advance state — but not unbounded. */
  maxConcurrentWorkflowTaskExecutions: 10,
  /**
   * Each cached workflow holds its history in memory. The default scales with
   * heap and can reach the hundreds; this worker runs a handful of schedules, so
   * a cache that size buys nothing and reserves memory the machine wants back.
   */
  maxCachedWorkflows: 50,
} as const;

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
    ...CONCURRENCY,
  });

  logger.info("AtlasMed Temporal worker started", {
    temporalAddress: config.temporalAddress,
    taskQueue: config.taskQueue,
    ...CONCURRENCY,
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
