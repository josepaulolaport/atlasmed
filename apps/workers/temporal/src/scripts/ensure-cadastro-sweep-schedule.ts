import {
  Client,
  Connection,
  ScheduleNotFoundError,
  ScheduleOverlapPolicy,
  type ScheduleClient,
} from "@temporalio/client";
import { loadWorkerConfig } from "../config";
import { logger } from "../logger";

export const CADASTRO_SWEEP_SCHEDULE = {
  scheduleId: "cadastro-sweep-every-10m",
  workflowId: "cadastro-sweep-every-10m",
} as const;

function scheduleOptions(input: { taskQueue: string }) {
  return {
    scheduleId: CADASTRO_SWEEP_SCHEDULE.scheduleId,
    spec: {
      /**
       * Ten minutes. The sweep only touches uploads older than the six-hour
       * grace, so the interval sets how promptly a stalled upload is reconciled
       * after that, not how quickly it becomes eligible. Frequent and cheap
       * beats rare and long: each tick is bounded to one batch.
       */
      intervals: [{ every: "10m" as const }],
    },
    policies: {
      /**
       * SKIP, not BUFFER_ONE. Two sweeps running at once would both read the
       * same stale rows and race to delete them.
       *
       * BUFFER_ONE is what turned a single stuck Emultec run into a dead
       * schedule on 2026-08-09: the buffered run waited behind it and every
       * later tick was discarded anyway, so the queue bought nothing and hid
       * the stall. With SKIP the next healthy tick simply runs.
       */
      overlap: ScheduleOverlapPolicy.SKIP,
      /**
       * No catch-up. After an outage the next tick reconciles everything that
       * accumulated anyway — the sweep is a scan, not a per-interval job, so a
       * burst of backdated runs would repeat identical work.
       */
      catchupWindow: "1m" as const,
    },
    action: {
      type: "startWorkflow" as const,
      workflowType: "cadastroSweepWorkflow",
      taskQueue: input.taskQueue,
      workflowId: CADASTRO_SWEEP_SCHEDULE.workflowId,
      args: [],
    },
  };
}

function isMissingSchedule(error: unknown): boolean {
  return error instanceof ScheduleNotFoundError;
}

/**
 * Create-or-update, so deploying twice is not an error and a changed interval
 * or policy actually lands. Mirrors the Emultec and purchase-recurrence
 * schedules; `state` is carried over so an operator's manual pause survives a
 * deploy.
 */
export async function ensureCadastroSweepSchedule(
  schedules: Pick<ScheduleClient, "create" | "getHandle">,
  input: { taskQueue: string }
): Promise<void> {
  const options = scheduleOptions(input);
  const handle = schedules.getHandle(CADASTRO_SWEEP_SCHEDULE.scheduleId);
  try {
    await handle.describe();
    await handle.update((previous) => ({
      spec: options.spec,
      policies: options.policies,
      action: options.action,
      state: previous.state,
    }));
    logger.info("cadastro.sweep.schedule_updated", {
      scheduleId: CADASTRO_SWEEP_SCHEDULE.scheduleId,
    });
  } catch (error) {
    if (!isMissingSchedule(error)) throw error;
    await schedules.create(options);
    logger.info("cadastro.sweep.schedule_created", {
      scheduleId: CADASTRO_SWEEP_SCHEDULE.scheduleId,
    });
  }
}

async function main(): Promise<void> {
  const config = loadWorkerConfig();
  const connection = await Connection.connect({ address: config.temporalAddress });
  try {
    const client = new Client({
      connection,
      namespace: config.temporalNamespace,
    });
    await ensureCadastroSweepSchedule(client.schedule, {
      taskQueue: config.taskQueue,
    });
  } finally {
    await connection.close();
  }
}

if (import.meta.main) {
  main().catch((error) => {
    logger.error("cadastro.sweep.schedule_failed", error);
    process.exit(1);
  });
}
