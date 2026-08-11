import { describe, expect, mock, test } from "bun:test";
import { ScheduleNotFoundError, ScheduleOverlapPolicy } from "@temporalio/client";
import {
  CADASTRO_SWEEP_SCHEDULE,
  ensureCadastroSweepSchedule,
} from "./ensure-cadastro-sweep-schedule";

type ScheduleShape = {
  action: { workflowType: string; taskQueue: string; args: unknown[] };
  policies: { overlap: ScheduleOverlapPolicy; catchupWindow: string };
  spec: { intervals: Array<{ every: string }> };
  state?: object;
};

function fakeSchedules(options: { exists: boolean }) {
  const create = mock(async (_options: unknown) => {});
  const updates: ScheduleShape[] = [];

  const handle = {
    describe: async () => {
      if (!options.exists) {
        throw new ScheduleNotFoundError("missing", CADASTRO_SWEEP_SCHEDULE.scheduleId);
      }
      return {};
    },
    update: async (updater: (previous: { state: object }) => ScheduleShape) => {
      updates.push(updater({ state: { paused: true } }));
    },
  };

  return {
    create,
    updates,
    client: { create, getHandle: () => handle } as never,
  };
}

describe("cadastro sweep schedule provisioning", () => {
  test("creates a 10m schedule that never overlaps", async () => {
    const fake = fakeSchedules({ exists: false });

    await ensureCadastroSweepSchedule(fake.client, { taskQueue: "atlasmed-workflows" });

    expect(fake.create).toHaveBeenCalledTimes(1);
    const options = fake.create.mock.calls[0]![0] as ScheduleShape & {
      scheduleId: string;
    };

    expect(options.scheduleId).toBe("cadastro-sweep-every-10m");
    // A typo here fails silently: Temporal would accept the schedule and every
    // tick would look for a workflow type no worker registers.
    expect(options.action.workflowType).toBe("cadastroSweepWorkflow");
    expect(options.action.taskQueue).toBe("atlasmed-workflows");
    expect(options.spec.intervals).toEqual([{ every: "10m" }]);
    // Two concurrent sweeps would read the same stale rows and race to delete
    // them. SKIP, never BUFFER_ONE — buffering is what turned one stuck Emultec
    // run into a dead schedule.
    expect(options.policies.overlap).toBe(ScheduleOverlapPolicy.SKIP);
  });

  test("updates an existing schedule instead of failing, and keeps its state", async () => {
    const fake = fakeSchedules({ exists: true });

    await ensureCadastroSweepSchedule(fake.client, { taskQueue: "atlasmed-workflows" });

    expect(fake.create).not.toHaveBeenCalled();
    expect(fake.updates).toHaveLength(1);
    expect(fake.updates[0]!.action.workflowType).toBe("cadastroSweepWorkflow");
    // An operator who paused the sweep must not have it silently resumed by the
    // next deploy.
    expect(fake.updates[0]!.state).toEqual({ paused: true });
  });
});
