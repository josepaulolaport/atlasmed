import {
  Client,
  Connection,
  ScheduleNotFoundError,
  ScheduleOverlapPolicy,
  type ScheduleClient,
} from "@temporalio/client";
import { loadWorkerConfig } from "../config";
import { logger } from "../logger";

export const LEGACY_EMULTEC_ORDER_IMPORT_SCHEDULE_ID = "emultec-order-import-daily";

/** Every 10 minutes HYBRID Emultec import (DLQ + reconcile + incremental). */
export const EMULTEC_ORDER_IMPORT_SCHEDULES = [
  {
    scheduleId: "emultec-order-import-every-10m",
    workflowId: "emultec-order-import-every-10m",
  },
] as const;

export const EMULTEC_ORDER_IMPORT_SCHEDULE_ARGS = {
  mode: "HYBRID" as const,
  reconcileDays: 30,
  pageSize: 200,
  triggerPurchaseRecurrence: true,
};

function scheduleOptions(
  definition: (typeof EMULTEC_ORDER_IMPORT_SCHEDULES)[number],
  input: { taskQueue: string }
) {
  return {
    scheduleId: definition.scheduleId,
    spec: {
      intervals: [{ every: "10m" as const }],
    },
    policies: {
      overlap: ScheduleOverlapPolicy.BUFFER_ONE,
      catchupWindow: "1h" as const,
    },
    action: {
      type: "startWorkflow" as const,
      workflowType: "emultecOrderImportWorkflow",
      taskQueue: input.taskQueue,
      workflowId: definition.workflowId,
      args: [EMULTEC_ORDER_IMPORT_SCHEDULE_ARGS],
    },
  };
}

function isMissingSchedule(error: unknown): boolean {
  return error instanceof ScheduleNotFoundError;
}

async function deleteLegacyDailySchedule(
  schedules: Pick<ScheduleClient, "getHandle">
): Promise<void> {
  try {
    await schedules.getHandle(LEGACY_EMULTEC_ORDER_IMPORT_SCHEDULE_ID).delete();
    logger.info("emultec.order_import.legacy_schedule_deleted", {
      scheduleId: LEGACY_EMULTEC_ORDER_IMPORT_SCHEDULE_ID,
    });
  } catch (error) {
    if (!isMissingSchedule(error)) throw error;
  }
}

export async function ensureEmultecOrderImportSchedules(
  schedules: Pick<ScheduleClient, "create" | "getHandle">,
  input: { taskQueue: string }
): Promise<void> {
  for (const definition of EMULTEC_ORDER_IMPORT_SCHEDULES) {
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
      logger.info("emultec.order_import.schedule_updated", {
        scheduleId: definition.scheduleId,
      });
    } catch (error) {
      if (!isMissingSchedule(error)) throw error;
      await schedules.create(options);
      logger.info("emultec.order_import.schedule_created", {
        scheduleId: definition.scheduleId,
      });
    }
  }

  await deleteLegacyDailySchedule(schedules);
}

async function main(): Promise<void> {
  const config = loadWorkerConfig();
  const connection = await Connection.connect({ address: config.temporalAddress });
  try {
    const client = new Client({
      connection,
      namespace: config.temporalNamespace,
    });
    await ensureEmultecOrderImportSchedules(client.schedule, {
      taskQueue: config.taskQueue,
    });
  } finally {
    await connection.close();
  }
}

if (import.meta.main) {
  main().catch((error) => {
    logger.error("emultec.order_import.schedule_failed", error);
    process.exit(1);
  });
}
