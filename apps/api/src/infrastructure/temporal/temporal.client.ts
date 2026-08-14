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
}

export interface CnesIngestionTriggerInput {
  /** Load this competência instead of discovering the newest published. */
  reference?: { year: number; month: number };
  /** Reload a competência already marked COMPLETED. */
  force?: boolean;
}

type CnesIngestionTemporalClient = {
  workflow: {
    start(
      workflowType: "cnesIngestionWorkflow",
      options: {
        taskQueue: string;
        workflowId: string;
        args: [CnesIngestionTriggerInput];
      }
    ): Promise<SearchSyncWorkflowStartHandle>;
    getHandle(workflowId: string): SearchSyncWorkflowDescriptionHandle;
  };
};

/**
 * One id per competência, or one for "whatever is newest".
 *
 * The workflow id *is* the mutual exclusion. A CNES load reads a 735 MB archive
 * and rewrites `registry.*` wholesale; two of them at once would race on the same
 * tables, which is why the weekly schedule uses `SKIP`. An on-demand trigger has
 * to obey the same rule, and asking under a fixed id is how — Temporal refuses
 * the second start rather than the database discovering the conflict.
 *
 * A discovery run gets a distinct id from a targeted one so that "load whatever
 * is newest" and "reload 2026-07" are not treated as the same request.
 */
export function cnesIngestionTriggerWorkflowId(
  input: CnesIngestionTriggerInput
): string {
  if (!input.reference) return "cnes-ingestion-trigger-latest";
  const month = String(input.reference.month).padStart(2, "0");
  return `cnes-ingestion-trigger-${input.reference.year}${month}`;
}

/**
 * Start an ingestion now rather than waiting for Sunday.
 *
 * `existing: true` is a normal answer, not a failure: it means a load for this
 * competência is already running and the caller should watch that one.
 */
export async function startCnesIngestionWorkflowWithClient(
  client: CnesIngestionTemporalClient,
  input: CnesIngestionTriggerInput
): Promise<StartWorkflowResult> {
  const workflowId = cnesIngestionTriggerWorkflowId(input);

  try {
    const handle = await client.workflow.start("cnesIngestionWorkflow", {
      taskQueue: environment.TEMPORAL_TASK_QUEUE,
      workflowId,
      args: [input],
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

export async function startCnesIngestionWorkflow(
  input: CnesIngestionTriggerInput
): Promise<StartWorkflowResult> {
  const client = await getTemporalClient();
  return startCnesIngestionWorkflowWithClient(
    client as unknown as CnesIngestionTemporalClient,
    input
  );
}

type MetricSnapshotTemporalClient = {
  workflow: {
    start(
      workflowType: "metricSnapshotWorkflow",
      options: {
        taskQueue: string;
        workflowId: string;
        args: [{ mode: "TRIGGER"; profileIds: number[] }];
      }
    ): Promise<SearchSyncWorkflowStartHandle>;
    getHandle(workflowId: string): SearchSyncWorkflowDescriptionHandle;
  };
};

/**
 * Deterministic per profile — that identity *is* the deduplication (§4.4).
 *
 * The Emultec importer upserts tens of orders per run every ten minutes, most of
 * them for the same handful of clinics. Every one of those writes asks for the
 * same recompute, so every one of them asks under the same workflow id, and
 * Temporal collapses them into the single run already in flight.
 *
 * The month the order falls in used to be part of this id, from when a recompute
 * addressed one month of a series. Since §4.6 a recompute rebuilds the whole
 * profile from a rolling window, so two orders backdated to different months
 * asked for the identical work under two ids and got two runs — the importer's
 * worst case, and precisely the case the id exists to collapse.
 */
export function metricSnapshotTriggerWorkflowId(input: MetricSnapshotTriggerInput): string {
  return `metric-snapshot-profile-${input.facilityVerticalProfileId}`;
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
        },
      ],
    });
    return { workflowId, runId: handle.firstExecutionRunId, existing: false };
  } catch (error) {
    if (error instanceof WorkflowExecutionAlreadyStartedError) {
      // Already queued for this profile: that is the design, not a fault. The
      // run in flight recomputes from stored state, so it will see this write
      // too — and if it read the table a moment before the write landed, the
      // hourly RECONCILE pass picks the profile up within the hour.
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

/**
 * An allowlist, not a pattern match — this decides what an admin may `describe`
 * through the operations endpoint, so it names ids rather than accepting any
 * string that happens to look like one.
 */
export function isFullSearchSyncWorkflowId(workflowId: string): boolean {
  return workflowId === fullSearchSyncWorkflowId("facilities")
    || workflowId === fullSearchSyncWorkflowId("persons")
    || workflowId === purchaseRecurrenceBackfillWorkflowId()
    || workflowId === emultecOrderImportWorkflowId()
    || workflowId === "emultec-order-import-every-10m"
    || workflowId === "emultec-order-import-backfill"
    || workflowId === "emultec-order-import-reconcile"
    || workflowId === "emultec-order-import-incremental"
    // Started by this endpoint, so its status has to be readable from it too.
    || workflowId === cnesIngestionTriggerWorkflowId({})
    || /^cnes-ingestion-trigger-\d{6}$/.test(workflowId)
    // The weekly schedule's own run, so an admin can check the last scheduled
    // load without reaching for the Temporal UI.
    || workflowId === "cnes-ingestion-weekly";
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

