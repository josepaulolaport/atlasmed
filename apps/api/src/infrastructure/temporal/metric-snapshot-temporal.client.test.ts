import { describe, expect, test } from "bun:test";
import { WorkflowExecutionAlreadyStartedError } from "@temporalio/client";
import {
  metricSnapshotTriggerWorkflowId,
  startMetricSnapshotTriggerWorkflowWithClient,
} from "./temporal.client";

/**
 * The recompute an order write asks for (spec 0013 §4.4).
 *
 * The workflow id *is* the deduplication, and the Emultec importer is what it
 * is for: tens of order upserts every ten minutes, most of them for the same
 * handful of clinics, each asking for a recompute of the same profile. If the id
 * is not identical across those writes, Temporal starts a run per write.
 */
function recordingClient(options: { duplicate?: boolean } = {}) {
  const started: Array<{ workflowId: string; args: unknown }> = [];
  return {
    started,
    client: {
      workflow: {
        start: async (
          _type: "metricSnapshotWorkflow",
          opts: { workflowId: string; args: unknown },
        ) => {
          if (options.duplicate) {
            throw new WorkflowExecutionAlreadyStartedError(
              "already running",
              opts.workflowId,
              "run-old",
            );
          }
          started.push({ workflowId: opts.workflowId, args: opts.args });
          return {
            firstExecutionRunId: "run-new",
            describe: async () => ({ runId: "run-new", status: { name: "RUNNING" } }),
          };
        },
        getHandle: () => ({
          firstExecutionRunId: "unused",
          describe: async () => ({ runId: "run-old", status: { name: "RUNNING" } }),
        }),
      },
    },
  };
}

describe("the metric snapshot trigger", () => {
  test("is keyed on the profile alone", () => {
    // Not on the order's month. A recompute rebuilds every metric of the profile
    // from a rolling window since §4.6, so two orders backdated to different
    // months ask for identical work — and used to get two runs for it, because
    // the month was in this string.
    expect(metricSnapshotTriggerWorkflowId({ facilityVerticalProfileId: 777 })).toBe(
      "metric-snapshot-profile-777",
    );
  });

  test("asks for the same id twice for the same profile", () => {
    // The property the deduplication rests on, stated directly: same profile,
    // same id, whatever else is true of the write.
    expect(metricSnapshotTriggerWorkflowId({ facilityVerticalProfileId: 777 })).toBe(
      metricSnapshotTriggerWorkflowId({ facilityVerticalProfileId: 777 }),
    );
  });

  test("keeps separate profiles separate", () => {
    expect(metricSnapshotTriggerWorkflowId({ facilityVerticalProfileId: 777 })).not.toBe(
      metricSnapshotTriggerWorkflowId({ facilityVerticalProfileId: 778 }),
    );
  });

  test("starts a TRIGGER run for that one profile, and nothing about months", async () => {
    const { client, started } = recordingClient();

    await expect(
      startMetricSnapshotTriggerWorkflowWithClient(client, { facilityVerticalProfileId: 777 }),
    ).resolves.toEqual({
      workflowId: "metric-snapshot-profile-777",
      runId: "run-new",
      existing: false,
    });
    expect(started).toHaveLength(1);
    expect(started[0]!.args).toEqual([{ mode: "TRIGGER", profileIds: [777] }]);
  });

  test("reports the run already in flight rather than failing the order write", async () => {
    // A duplicate is the design working. The order is committed by this point,
    // so raising here would fail a write that succeeded.
    const { client } = recordingClient({ duplicate: true });

    await expect(
      startMetricSnapshotTriggerWorkflowWithClient(client, { facilityVerticalProfileId: 777 }),
    ).resolves.toEqual({
      workflowId: "metric-snapshot-profile-777",
      runId: "run-old",
      existing: true,
    });
  });
});
