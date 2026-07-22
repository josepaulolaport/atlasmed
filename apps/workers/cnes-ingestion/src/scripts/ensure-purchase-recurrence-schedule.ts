import { Client, Connection, ScheduleOverlapPolicy, type ScheduleClient } from "@temporalio/client";
import { loadWorkerConfig } from "../config";
import { logger } from "../logger";

export const PURCHASE_RECURRENCE_SCHEDULES = [
  {
    scheduleId: "facility-purchase-recurrence-hourly",
    workflowId: "facility-purchase-recurrence-hourly",
    overlap: "SKIP" as const,
    calendar: { minute: 0 },
    fullSweep: false,
  },
  {
    scheduleId: "facility-purchase-recurrence-nightly-repair",
    workflowId: "facility-purchase-recurrence-nightly-repair",
    overlap: "SKIP" as const,
    calendar: { hour: 0, minute: 0 },
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
      args: [{
        mode: "RECONCILE" as const,
        ...(definition.fullSweep ? { fullSweep: true } : {}),
      }],
    },
  };
}

function isMissingSchedule(error: unknown): boolean {
  return error instanceof Error && (error.name === "ScheduleNotFoundError" || error.message.includes("not found"));
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
