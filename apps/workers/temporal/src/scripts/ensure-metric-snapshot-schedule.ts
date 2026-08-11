import {
  Client,
  Connection,
  ScheduleNotFoundError,
  ScheduleOverlapPolicy,
  type ScheduleClient,
} from "@temporalio/client";
import { loadWorkerConfig } from "../config";
import { logger } from "../logger";

/**
 * The reconciliation sweep's schedule (spec 0013 §4.4).
 *
 * Hourly on the hour, mirroring `facility-purchase-recurrence-hourly` rather
 * than inventing a second cadence — the two reconcile the same kind of derived
 * value from the same orders table, and one convention is easier to reason about
 * at 3am than two.
 *
 * `SKIP` on overlap, not `BUFFER_ONE`: the recompute is idempotent and
 * watermark-driven, so a skipped run costs at most one interval of staleness and
 * the next run's window still covers what the skipped one would have. Buffering
 * would queue redundant work behind a slow run for no gain.
 */
export const METRIC_SNAPSHOT_SCHEDULES = [
  {
    scheduleId: "facility-metric-snapshot-hourly",
    workflowId: "facility-metric-snapshot-hourly",
    calendar: { minute: 0 },
  },
] as const;

function scheduleOptions(
  definition: (typeof METRIC_SNAPSHOT_SCHEDULES)[number],
  input: { taskQueue: string },
) {
  return {
    scheduleId: definition.scheduleId,
    spec: { calendars: [definition.calendar] },
    policies: { overlap: ScheduleOverlapPolicy.SKIP },
    action: {
      type: "startWorkflow" as const,
      workflowType: "metricSnapshotWorkflow",
      taskQueue: input.taskQueue,
      workflowId: definition.workflowId,
      args: [{ mode: "RECONCILE" as const }],
    },
  };
}

function isMissingSchedule(error: unknown): boolean {
  return error instanceof ScheduleNotFoundError;
}

export async function ensureMetricSnapshotSchedules(
  schedules: Pick<ScheduleClient, "create" | "getHandle">,
  input: { taskQueue: string },
): Promise<void> {
  for (const definition of METRIC_SNAPSHOT_SCHEDULES) {
    const options = scheduleOptions(definition, { taskQueue: input.taskQueue });
    const handle = schedules.getHandle(definition.scheduleId);
    try {
      await handle.describe();
      await handle.update((previous) => ({
        spec: options.spec,
        policies: options.policies,
        action: options.action,
        // Preserved deliberately: an operator who paused this schedule during an
        // incident must not have it silently resumed by the next deploy.
        state: previous.state,
      }));
      logger.info("facility_metric_snapshot.schedule_updated", {
        scheduleId: definition.scheduleId,
      });
    } catch (error) {
      if (!isMissingSchedule(error)) throw error;
      await schedules.create(options);
      logger.info("facility_metric_snapshot.schedule_created", {
        scheduleId: definition.scheduleId,
      });
    }
  }
}

async function main(): Promise<void> {
  const config = loadWorkerConfig();
  const connection = await Connection.connect({ address: config.temporalAddress });
  try {
    const client = new Client({ connection, namespace: config.temporalNamespace });
    await ensureMetricSnapshotSchedules(client.schedule, { taskQueue: config.taskQueue });
  } finally {
    await connection.close();
  }
}

if (import.meta.main) {
  main().catch((error) => {
    logger.error("facility_metric_snapshot.schedule_failed", error);
    process.exit(1);
  });
}
