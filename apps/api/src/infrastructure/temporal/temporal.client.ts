import { Connection, Client, WorkflowExecutionAlreadyStartedError } from "@temporalio/client";
import { environment } from "../../app/config/environment";

let connectionPromise: Promise<Connection> | null = null;
let clientPromise: Promise<Client> | null = null;

async function getConnection(): Promise<Connection> {
  if (!connectionPromise) {
    connectionPromise = Connection.connect({
      address: environment.TEMPORAL_ADDRESS,
    });
  }

  return connectionPromise;
}

export async function getTemporalClient(): Promise<Client> {
  if (!clientPromise) {
    const connection = await getConnection();
    clientPromise = Promise.resolve(
      new Client({
        connection,
        namespace: environment.TEMPORAL_NAMESPACE,
      })
    );
  }

  return clientPromise;
}

export type SearchSyncEntity = "facilities" | "persons";
type StartWorkflowResult = { workflowId: string; runId: string; existing: boolean };

type SearchSyncWorkflowDescriptionHandle = {
  describe(): Promise<{ runId: string; status: { name: string } }>;
};

type SearchSyncWorkflowStartHandle = SearchSyncWorkflowDescriptionHandle & {
  firstExecutionRunId: string;
};

type SearchSyncTemporalClient = {
  workflow: {
    start(
      workflowType: "fullSearchSyncWorkflow" | "purchaseRecurrenceWorkflow",
      options: {
        taskQueue: string;
        workflowId: string;
        args: [{ target: SearchSyncEntity }] | [{ mode: "BACKFILL" }];
      }
    ): Promise<SearchSyncWorkflowStartHandle>;
    getHandle(workflowId: string): SearchSyncWorkflowDescriptionHandle;
  };
};

export function fullSearchSyncWorkflowId(entity: SearchSyncEntity): string {
  return "search-sync-" + entity + "-full";
}

export async function startFullSearchSyncWorkflowWithClient(
  client: SearchSyncTemporalClient,
  entity: SearchSyncEntity
): Promise<{ workflowId: string; runId: string; existing: boolean }> {
  const workflowId = fullSearchSyncWorkflowId(entity);

  try {
    const handle = await client.workflow.start("fullSearchSyncWorkflow", {
      taskQueue: environment.TEMPORAL_TASK_QUEUE,
      workflowId,
      args: [{ target: entity }],
    });
    return { workflowId, runId: handle.firstExecutionRunId, existing: false };
  } catch (error) {
    if (error instanceof WorkflowExecutionAlreadyStartedError) {
      const description = await client.workflow.getHandle(workflowId).describe();
      return { workflowId, runId: description.runId, existing: true };
    }
    throw error;
  }
}

export async function startFullSearchSyncWorkflow(
  entity: SearchSyncEntity
): Promise<StartWorkflowResult> {
  return startFullSearchSyncWorkflowWithClient(await getTemporalClient(), entity);
}

export function purchaseRecurrenceBackfillWorkflowId(): string {
  return "purchase-recurrence-backfill";
}

export async function startPurchaseRecurrenceBackfillWorkflowWithClient(
  client: SearchSyncTemporalClient
): Promise<StartWorkflowResult> {
  const workflowId = purchaseRecurrenceBackfillWorkflowId();

  try {
    const handle = await client.workflow.start("purchaseRecurrenceWorkflow", {
      taskQueue: environment.TEMPORAL_TASK_QUEUE,
      workflowId,
      args: [{ mode: "BACKFILL" }],
    });
    return { workflowId, runId: handle.firstExecutionRunId, existing: false };
  } catch (error) {
    if (error instanceof WorkflowExecutionAlreadyStartedError) {
      const description = await client.workflow.getHandle(workflowId).describe();
      return { workflowId, runId: description.runId, existing: true };
    }
    throw error;
  }
}

export async function startPurchaseRecurrenceBackfillWorkflow(): Promise<StartWorkflowResult> {
  return startPurchaseRecurrenceBackfillWorkflowWithClient(await getTemporalClient());
}

export function emultecOrderImportWorkflowId(): string {
  return "emultec-order-import-hybrid";
}

export async function startEmultecOrderImportWorkflow(): Promise<StartWorkflowResult> {
  const client = await getTemporalClient();
  const workflowId = emultecOrderImportWorkflowId();

  try {
    const handle = await client.workflow.start("emultecOrderImportWorkflow", {
      taskQueue: environment.TEMPORAL_TASK_QUEUE,
      workflowId,
      args: [
        {
          mode: "HYBRID" as const,
          reconcileDays: 30,
          pageSize: 200,
          triggerPurchaseRecurrence: true,
        },
      ],
    });
    return { workflowId, runId: handle.firstExecutionRunId, existing: false };
  } catch (error) {
    if (error instanceof WorkflowExecutionAlreadyStartedError) {
      const description = await client.workflow.getHandle(workflowId).describe();
      return { workflowId, runId: description.runId, existing: true };
    }
    throw error;
  }
}

export interface MetricSnapshotTriggerInput {
  facilityVerticalProfileId: number;
  /** The months the write can have moved. Month keys, `YYYY-MM-01`. */
  months: string[];
}

type MetricSnapshotTemporalClient = {
  workflow: {
    start(
      workflowType: "metricSnapshotWorkflow",
      options: {
        taskQueue: string;
        workflowId: string;
        args: [{ mode: "TRIGGER"; profileIds: number[]; months: string[] }];
      }
    ): Promise<SearchSyncWorkflowStartHandle>;
    getHandle(workflowId: string): SearchSyncWorkflowDescriptionHandle;
  };
};

/**
 * Deterministic per (profile, month window) — that identity *is* the
 * deduplication (spec 0013 §4.4).
 *
 * The Emultec importer upserts tens of orders per run every ten minutes, most of
 * them for the same handful of clinics. Every one of those writes asks for the
 * same recompute, so every one of them asks under the same workflow id, and
 * Temporal collapses them into the single run already in flight.
 */
export function metricSnapshotTriggerWorkflowId(input: MetricSnapshotTriggerInput): string {
  const first = input.months[0];
  const last = input.months[input.months.length - 1];
  return `metric-snapshot-profile-${input.facilityVerticalProfileId}-${first}-${last}`;
}

export async function startMetricSnapshotTriggerWorkflowWithClient(
  client: MetricSnapshotTemporalClient,
  input: MetricSnapshotTriggerInput
): Promise<StartWorkflowResult> {
  const workflowId = metricSnapshotTriggerWorkflowId(input);

  try {
    const handle = await client.workflow.start("metricSnapshotWorkflow", {
      taskQueue: environment.TEMPORAL_TASK_QUEUE,
      workflowId,
      args: [
        {
          mode: "TRIGGER" as const,
          profileIds: [input.facilityVerticalProfileId],
          months: input.months,
        },
      ],
    });
    return { workflowId, runId: handle.firstExecutionRunId, existing: false };
  } catch (error) {
    if (error instanceof WorkflowExecutionAlreadyStartedError) {
      // Already queued for this profile and window: that is the design, not a
      // fault. The run in flight recomputes from stored state, so it will see
      // this write too.
      const description = await client.workflow.getHandle(workflowId).describe();
      return { workflowId, runId: description.runId, existing: true };
    }
    throw error;
  }
}

export async function startMetricSnapshotTriggerWorkflow(
  input: MetricSnapshotTriggerInput
): Promise<StartWorkflowResult> {
  return startMetricSnapshotTriggerWorkflowWithClient(await getTemporalClient(), input);
}

export function isFullSearchSyncWorkflowId(workflowId: string): boolean {
  return workflowId === fullSearchSyncWorkflowId("facilities")
    || workflowId === fullSearchSyncWorkflowId("persons")
    || workflowId === purchaseRecurrenceBackfillWorkflowId()
    || workflowId === emultecOrderImportWorkflowId()
    || workflowId === "emultec-order-import-every-10m"
    || workflowId === "emultec-order-import-backfill"
    || workflowId === "emultec-order-import-reconcile"
    || workflowId === "emultec-order-import-incremental";
}

export async function describeSearchSyncWorkflow(workflowId: string): Promise<{
  workflowId: string;
  runId: string;
  status: string;
}> {
  const client = await getTemporalClient();
  const description = await client.workflow.getHandle(workflowId).describe();
  return { workflowId, runId: description.runId, status: description.status.name };
}

