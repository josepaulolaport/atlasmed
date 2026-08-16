import {
  Client,
  Connection,
  ScheduleNotFoundError,
  ScheduleOverlapPolicy,
  type ScheduleClient,
} from "@temporalio/client";
import { loadWorkerConfig } from "../config";
import { logger } from "../logger";

export const LEGACY_PURCHASE_RECURRENCE_SCHEDULE_ID = "facility-purchase-recurrence-nightly-repair";

export const PURCHASE_RECURRENCE_SCHEDULES = [
  {
    scheduleId: "facility-purchase-recurrence-hourly",
    workflowId: "facility-purchase-recurrence-hourly",
    /**
     * `hour: "*"` is load-bearing. Temporal defaults an omitted calendar field
     * to 0, not to every value, so `{ minute: 0 }` resolves to `hour: "0"` —
     * midnight daily, which is what ran in production until 2026-08-14.
     *
     * That also silently disabled the incremental path: the workflow took its
     * `fullSweep` branch when `scheduledAt.getUTCHours() === 0`, so the single
     * daily run was always a full sweep and the `since`/`until` window never
     * executed. Nothing was lost, but a purchase waited until the next midnight
     * to be reflected instead of the next hour.
     */
    calendar: { minute: 0, hour: "*" },
    fullSweep: false,
  },
  {
    /**
     * The daily repair, on its own schedule id.
     *
     * It used to be a branch inside the hourly run, chosen by the hour of day.
     * `SKIP` then coupled the two: an hourly run that overran past midnight
     * caused the midnight firing to be skipped, and the sweep with it — losing
     * the one pass that catches deleted orders, external writers that did not
     * move `updated_at`, and any window the incremental path missed. A separate
     * id cannot be skipped by an overrunning hourly run.
     *
     * 06:30 UTC is 03:30 in São Paulo. The old midnight-UTC slot was 21:00 there
     * — inside the working evening, which is the worst time to hold row locks
     * across every active facility.
     */
    scheduleId: "facility-purchase-recurrence-daily-sweep",
    workflowId: "facility-purchase-recurrence-daily-sweep",
    calendar: { minute: 30, hour: 6 },
    fullSweep: true,
  },
] as const;

function scheduleOptions(definition: typeof PURCHASE_RECURRENCE_SCHEDULES[number], input: {
  taskQueue: string;
}) {
  return {
    scheduleId: definition.scheduleId,
    spec: { calendars: [definition.calendar] },
    policies: { overlap: ScheduleOverlapPolicy.SKIP },
    action: {
      type: "startWorkflow" as const,
      workflowType: "purchaseRecurrenceWorkflow",
      taskQueue: input.taskQueue,
      workflowId: definition.workflowId,
      args: [{ mode: "RECONCILE" as const, fullSweep: definition.fullSweep }],
    },
  };
}

function isMissingSchedule(error: unknown): boolean {
  return error instanceof ScheduleNotFoundError;
}

async function deleteLegacyPurchaseRecurrenceSchedule(
  schedules: Pick<ScheduleClient, "getHandle">,
): Promise<void> {
  try {
    // Remove the superseded nightly repair schedule so only the canonical hourly reconciler can run.
    await schedules.getHandle(LEGACY_PURCHASE_RECURRENCE_SCHEDULE_ID).delete();
    logger.info("facility_purchase_recurrence.legacy_schedule_deleted", {
      scheduleId: LEGACY_PURCHASE_RECURRENCE_SCHEDULE_ID,
    });
  } catch (error) {
    if (!isMissingSchedule(error)) throw error;
  }
}

export async function ensurePurchaseRecurrenceSchedules(
  schedules: Pick<ScheduleClient, "create" | "getHandle">,
  input: { taskQueue: string },
): Promise<void> {
  for (const definition of PURCHASE_RECURRENCE_SCHEDULES) {
    const options = scheduleOptions(definition, { taskQueue: input.taskQueue });
    const handle = schedules.getHandle(definition.scheduleId);
    try {
      await handle.describe();
      await handle.update((previous) => ({
        spec: options.spec,
        policies: options.policies,
        action: options.action,
        state: previous.state,
      }));
      logger.info("facility_purchase_recurrence.schedule_updated", { scheduleId: definition.scheduleId });
    } catch (error) {
      if (!isMissingSchedule(error)) throw error;
      await schedules.create(options);
      logger.info("facility_purchase_recurrence.schedule_created", { scheduleId: definition.scheduleId });
    }
  }

  await deleteLegacyPurchaseRecurrenceSchedule(schedules);
}

async function main(): Promise<void> {
  const config = loadWorkerConfig();
  const connection = await Connection.connect({ address: config.temporalAddress });
  try {
    const client = new Client({ connection, namespace: config.temporalNamespace });
    await ensurePurchaseRecurrenceSchedules(client.schedule, { taskQueue: config.taskQueue });
  } finally {
    await connection.close();
  }
}

if (import.meta.main) {
  main().catch((error) => {
    logger.error("facility_purchase_recurrence.schedule_failed", error);
    process.exit(1);
  });
}
