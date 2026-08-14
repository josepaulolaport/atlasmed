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
 * Two schedules, because they answer different questions (spec 0013 §4.4, §4.6).
 *
 * **Hourly RECONCILE** catches profiles whose orders changed, and repairs an
 * inline recompute that never ran. Watermark-driven, so it only visits clinics
 * where something happened.
 *
 * **Nightly NIGHTLY** visits every profile. `ours` is a rolling 90-day window,
 * so a clinic's value moves as orders age out of it — with no event, and
 * therefore with nothing for a watermark to select. Without this pass a quiet
 * clinic's number freezes at whatever the window said when it was last touched.
 * 03:00 keeps it clear of the hourly run and of business hours.
 *
 * `SKIP` on overlap, not `BUFFER_ONE`: the recompute is idempotent, so a skipped
 * run costs at most one interval of staleness and the next run covers what it
 * would have. Buffering would queue redundant work behind a slow run for no gain.
 */
export const METRIC_SNAPSHOT_SCHEDULES = [
  {
    scheduleId: "facility-metric-snapshot-hourly",
    workflowId: "facility-metric-snapshot-hourly",
    /**
     * `hour: "*"` is load-bearing — Temporal defaults an omitted calendar field
     * to 0, so `{ minute: 0 }` means midnight daily, not hourly. This ran at
     * 00:00 in production until 2026-08-14, colliding with the nightly pass the
     * 03:00 above was chosen to stay clear of.
     */
    calendar: { minute: 0, hour: "*" },
    mode: "RECONCILE",
  },
  {
    scheduleId: "facility-metric-snapshot-nightly",
    workflowId: "facility-metric-snapshot-nightly",
    calendar: { hour: 3, minute: 0 },
    mode: "NIGHTLY",
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
      args: [{ mode: definition.mode }],
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
