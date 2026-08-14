import {
  Client,
  Connection,
  ScheduleNotFoundError,
  ScheduleOverlapPolicy,
  type ScheduleClient,
} from "@temporalio/client";
import { loadWorkerConfig } from "../config";
import { logger } from "../logger";

export const CNES_INGESTION_SCHEDULE = {
  scheduleId: "cnes-ingestion-weekly",
  workflowId: "cnes-ingestion-weekly",
} as const;

function scheduleOptions(input: { taskQueue: string }) {
  return {
    scheduleId: CNES_INGESTION_SCHEDULE.scheduleId,
    spec: {
      /**
       * Weekly, for a monthly export — Sunday 04:00.
       *
       * DATASUS publishes on no fixed day, so a monthly trigger would either
       * fire before the new competence exists or wait weeks after it appears.
       * A periodic check discovers the newest competence and returns SKIPPED
       * when it is already loaded, which is what most ticks are.
       *
       * Weekly rather than daily: a skip is cheap but not free — it is an FTP
       * listing against DATASUS — and the export appears once a month, so a
       * daily tick spends about thirty checks to find one new competence. A
       * week is still four chances to catch a publication within days of it
       * landing, and `POST /cnes/ingestion` exists for when somebody wants it
       * now rather than on Sunday.
       */
      cronExpressions: ["0 4 * * 0"],
    },
    policies: {
      /**
       * SKIP. A load can run for over an hour, and a second one would race the
       * first on the same staging-free registry tables. BUFFER_ONE was what
       * turned a stuck Emultec run into a dead schedule on 2026-08-09.
       */
      overlap: ScheduleOverlapPolicy.SKIP,
      /**
       * No catch-up. After an outage the next tick loads the newest competence
       * anyway; backdated runs would each re-discover the same archive.
       */
      catchupWindow: "1m" as const,
    },
    action: {
      type: "startWorkflow" as const,
      workflowType: "cnesIngestionWorkflow",
      taskQueue: input.taskQueue,
      workflowId: CNES_INGESTION_SCHEDULE.workflowId,
      args: [{}],
    },
  };
}

function isMissingSchedule(error: unknown): boolean {
  return error instanceof ScheduleNotFoundError;
}

/**
 * Create-or-update, so deploying twice is not an error and a changed cron or
 * policy actually lands. `state` is carried over so an operator's manual pause
 * survives a deploy.
 */
export async function ensureCnesIngestionSchedule(
  schedules: Pick<ScheduleClient, "create" | "getHandle">,
  input: { taskQueue: string }
): Promise<void> {
  const options = scheduleOptions(input);
  const handle = schedules.getHandle(CNES_INGESTION_SCHEDULE.scheduleId);
  try {
    await handle.describe();
    await handle.update((previous) => ({
      spec: options.spec,
      policies: options.policies,
      action: options.action,
      state: previous.state,
    }));
    logger.info("cnes.ingestion.schedule_updated", {
      scheduleId: CNES_INGESTION_SCHEDULE.scheduleId,
    });
  } catch (error) {
    if (!isMissingSchedule(error)) throw error;
    await schedules.create(options);
    logger.info("cnes.ingestion.schedule_created", {
      scheduleId: CNES_INGESTION_SCHEDULE.scheduleId,
    });
  }
}

async function main(): Promise<void> {
  const config = loadWorkerConfig();
  const connection = await Connection.connect({ address: config.temporalAddress });
  try {
    const client = new Client({ connection, namespace: config.temporalNamespace });
    await ensureCnesIngestionSchedule(client.schedule, {
      taskQueue: config.taskQueue,
    });
  } finally {
    await connection.close();
  }
}

if (import.meta.main) {
  main().catch((error) => {
    logger.error("cnes.ingestion.schedule_failed", error);
    process.exit(1);
  });
}
