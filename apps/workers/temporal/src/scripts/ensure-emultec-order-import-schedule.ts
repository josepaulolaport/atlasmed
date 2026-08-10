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

/** Every 10 minutes full BACKFILL Emultec import (paged by avulsa.id, no date window). */
export const EMULTEC_ORDER_IMPORT_SCHEDULES = [
  {
    scheduleId: "emultec-order-import-every-10m",
    workflowId: "emultec-order-import-every-10m",
  },
] as const;

export const EMULTEC_ORDER_IMPORT_SCHEDULE_ARGS = {
  /**
   * HYBRID, not BACKFILL. A timer that fires every 10 minutes must not launch a
   * full backfill each time — BACKFILL pages from the watermark with no natural
   * stopping point, against a third-party production database. HYBRID is what
   * the runs that actually succeeded on 2026-08-09 used.
   *
   * A real backfill is a deliberate, one-off run with an explicit maxPages.
   */
  mode: "HYBRID" as const,
  pageSize: 200,
  /**
   * Belt and braces with the workflow's own default: a scheduled run reads at
   * most 50 x 200 rows, far more than any 10-minute window can produce.
   */
  maxPages: 50,
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
      /**
       * SKIP, not BUFFER_ONE. Only one import may touch Emultec at a time, and
       * a tick that arrives while one is running is dropped rather than queued.
       *
       * BUFFER_ONE is what turned a single stuck run on 2026-08-09 into a dead
       * schedule: the buffered run waited behind it and every later tick was
       * discarded anyway, so the queue bought nothing and hid the stall. With
       * SKIP the next healthy tick simply runs.
       */
      overlap: ScheduleOverlapPolicy.SKIP,
      /**
       * No catch-up. After an outage we want the next scheduled read, not a
       * burst of backdated ones aimed at someone else's database.
       */
      catchupWindow: "1m" as const,
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
