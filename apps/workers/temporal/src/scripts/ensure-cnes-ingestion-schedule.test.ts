import { describe, expect, mock, test } from "bun:test";
import { ScheduleNotFoundError, ScheduleOverlapPolicy } from "@temporalio/client";
import {
  CNES_INGESTION_SCHEDULE,
  ensureCnesIngestionSchedule,
} from "./ensure-cnes-ingestion-schedule";

type ScheduleShape = {
  scheduleId: string;
  action: { workflowType: string; taskQueue: string; args: unknown[] };
  policies: { overlap: ScheduleOverlapPolicy; catchupWindow: string };
  spec: { cronExpressions: string[] };
  state?: object;
};

function fakeSchedules(options: { exists: boolean }) {
  const create = mock(async (_options: unknown) => {});
  const updates: ScheduleShape[] = [];

  const handle = {
    describe: async () => {
      if (!options.exists) {
        throw new ScheduleNotFoundError("missing", CNES_INGESTION_SCHEDULE.scheduleId);
      }
      return {};
    },
    update: async (updater: (previous: { state: object }) => ScheduleShape) => {
      updates.push(updater({ state: { paused: true } }));
    },
  };

  return { create, updates, client: { create, getHandle: () => handle } as never };
}

describe("cnes ingestion schedule provisioning", () => {
  test("creates a weekly schedule that never overlaps and never catches up", async () => {
    const fake = fakeSchedules({ exists: false });

    await ensureCnesIngestionSchedule(fake.client, { taskQueue: "atlasmed-workflows" });

    expect(fake.create).toHaveBeenCalledTimes(1);
    const options = fake.create.mock.calls[0]![0] as ScheduleShape;
    expect(options.action.workflowType).toBe("cnesIngestionWorkflow");
    expect(options.action.taskQueue).toBe("atlasmed-workflows");
    // Daily, because DATASUS publishes the monthly export on no fixed day.
    // Sunday 04:00. Weekly, not daily: the export is monthly, so a daily tick
    // spends ~30 FTP listings to find one new competence.
    expect(options.spec.cronExpressions).toEqual(["0 4 * * 0"]);
    /**
     * A load runs for many minutes against registry tables with no staging, so
     * two at once would race. BUFFER_ONE is what turned a stuck Emultec run into
     * a dead schedule on 2026-08-09.
     */
    expect(options.policies.overlap).toBe(ScheduleOverlapPolicy.SKIP);
    expect(options.policies.catchupWindow).toBe("1m");
  });

  test("updates in place and keeps an operator's pause", async () => {
    const fake = fakeSchedules({ exists: true });

    await ensureCnesIngestionSchedule(fake.client, { taskQueue: "atlasmed-workflows" });

    expect(fake.create).toHaveBeenCalledTimes(0);
    expect(fake.updates).toHaveLength(1);
    // Deploying must not silently resume a schedule someone paused deliberately.
    expect(fake.updates[0]!.state).toEqual({ paused: true });
    expect(fake.updates[0]!.action.workflowType).toBe("cnesIngestionWorkflow");
  });
});
