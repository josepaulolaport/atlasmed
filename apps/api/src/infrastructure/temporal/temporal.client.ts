import { Connection, Client, WorkflowExecutionAlreadyStartedError } from "@temporalio/client";
import { environment } from "../../app/config/environment";
import { workflowIdForReference } from "@atlasmed/cnes-ingestion";

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

export async function startCnesIngestionWorkflow(input: {
  ingestionRunId: string;
  ano?: number;
  mes?: number;
}): Promise<{ workflowId: string }> {
  const client = await getTemporalClient();
  const ano = input.ano ?? new Date().getFullYear();
  const mes = input.mes ?? new Date().getMonth() + 1;
  const workflowId = workflowIdForReference(ano, mes);

  try {
    await client.workflow.start("cnesMonthlyIngestionWorkflow", {
      taskQueue: environment.TEMPORAL_TASK_QUEUE,
      workflowId,
      args: [
        {
          ingestionRunId: input.ingestionRunId,
          ano: input.ano,
          mes: input.mes,
        },
      ],
    });
  } catch (error) {
    if (error instanceof WorkflowExecutionAlreadyStartedError) {
      return { workflowId };
    }
    throw error;
  }

  return { workflowId };
}

export async function describeCnesIngestionWorkflow(workflowId: string) {
  const client = await getTemporalClient();
  const handle = client.workflow.getHandle(workflowId);
  return handle.describe();
}


export type SearchSyncEntity = "facilities" | "professionals";

type SearchSyncWorkflowDescriptionHandle = {
  describe(): Promise<{ runId: string; status: { name: string } }>;
};

type SearchSyncWorkflowStartHandle = SearchSyncWorkflowDescriptionHandle & {
  firstExecutionRunId: string;
};

type SearchSyncTemporalClient = {
  workflow: {
    start(
      workflowType: "fullSearchSyncWorkflow",
      options: {
        taskQueue: string;
        workflowId: string;
        args: [{ target: SearchSyncEntity }];
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
): Promise<{ workflowId: string; runId: string; existing: boolean }> {
  return startFullSearchSyncWorkflowWithClient(await getTemporalClient(), entity);
}

export function isFullSearchSyncWorkflowId(workflowId: string): boolean {
  return workflowId === fullSearchSyncWorkflowId("facilities") || workflowId === fullSearchSyncWorkflowId("professionals");
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

export function cadastroFileUploadedWorkflowId(fileAssetId: string): string {
  return `cadastro-file-${fileAssetId}`;
}

export async function startCadastroFileUploadedWorkflow(input: {
  fileAssetId: string;
  bucket: string;
  objectKey: string;
}): Promise<{ workflowId: string }> {
  const client = await getTemporalClient();
  const workflowId = cadastroFileUploadedWorkflowId(input.fileAssetId);

  try {
    await client.workflow.start("cadastroFileUploadedWorkflow", {
      taskQueue: environment.TEMPORAL_TASK_QUEUE,
      workflowId,
      args: [
        {
          fileAssetId: input.fileAssetId,
          bucket: input.bucket,
          objectKey: input.objectKey,
        },
      ],
    });
  } catch (error) {
    if (error instanceof WorkflowExecutionAlreadyStartedError) {
      return { workflowId };
    }
    throw error;
  }

  return { workflowId };
}

export { workflowIdForReference };
