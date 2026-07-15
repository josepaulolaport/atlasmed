import { workflowIdForReference } from '@atlasmed/cnes-ingestion'
import { Client, Connection, WorkflowExecutionAlreadyStartedError } from '@temporalio/client'
import { environment } from '../../app/config/environment'

let connectionPromise: Promise<Connection> | null = null
let clientPromise: Promise<Client> | null = null

async function getConnection(): Promise<Connection> {
  if (!connectionPromise) {
    connectionPromise = Connection.connect({
      address: environment.TEMPORAL_ADDRESS
    })
  }

  return connectionPromise
}

export async function getTemporalClient(): Promise<Client> {
  if (!clientPromise) {
    const connection = await getConnection()
    clientPromise = Promise.resolve(
      new Client({
        connection,
        namespace: environment.TEMPORAL_NAMESPACE
      })
    )
  }

  return clientPromise
}

export async function startCnesIngestionWorkflow(input: {
  ingestionRunId: string
  ano?: number
  mes?: number
}): Promise<{ workflowId: string }> {
  const client = await getTemporalClient()
  const ano = input.ano ?? new Date().getFullYear()
  const mes = input.mes ?? new Date().getMonth() + 1
  const workflowId = workflowIdForReference(ano, mes)

  try {
    await client.workflow.start('cnesMonthlyIngestionWorkflow', {
      taskQueue: environment.TEMPORAL_TASK_QUEUE,
      workflowId,
      args: [
        {
          ingestionRunId: input.ingestionRunId,
          ano: input.ano,
          mes: input.mes
        }
      ]
    })
  } catch (error) {
    if (error instanceof WorkflowExecutionAlreadyStartedError) {
      return { workflowId }
    }
    throw error
  }

  return { workflowId }
}

export async function describeCnesIngestionWorkflow(workflowId: string) {
  const client = await getTemporalClient()
  const handle = client.workflow.getHandle(workflowId)
  return handle.describe()
}

export { workflowIdForReference }
