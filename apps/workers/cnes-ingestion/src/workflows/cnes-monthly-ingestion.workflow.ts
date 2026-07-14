import { proxyActivities } from "@temporalio/workflow";
import type { WorkflowInput, WorkflowResult } from "./types";

function workflowIdForReference(ano: number, mes: number): string {
  return `cnes-ingestion-${ano}-${String(mes).padStart(2, "0")}`;
}

const activities = proxyActivities<typeof import("../activities/index")>({
  startToCloseTimeout: "120 minutes",
  retry: {
    maximumAttempts: 3,
  },
});

export async function cnesMonthlyIngestionWorkflow(
  input: WorkflowInput
): Promise<WorkflowResult> {
  const reference = await activities.discoverLatestReferenceActivity({
    ingestionRunId: input.ingestionRunId,
    ano: input.ano,
    mes: input.mes,
  });

  const download = await activities.downloadRawFilesActivity({
    ingestionRunId: input.ingestionRunId,
    ano: reference.ano,
    mes: reference.mes,
  });

  const extracted = await activities.extractMonthlyArchiveActivity({
    ingestionRunId: input.ingestionRunId,
    ano: reference.ano,
    mes: reference.mes,
  });

  const preflight = await activities.preflightExtractedCsvActivity({
    ingestionRunId: input.ingestionRunId,
    ano: reference.ano,
    mes: reference.mes,
    extractPath: extracted.extractPath,
  });

  const parsed = await activities.parseAndNormalizeActivity({
    ingestionRunId: input.ingestionRunId,
    ano: reference.ano,
    mes: reference.mes,
  });

  const loaded = await activities.loadRegistryStagingActivity({
    ingestionRunId: input.ingestionRunId,
    ano: reference.ano,
    mes: reference.mes,
    extractPath: extracted.extractPath,
  });

  const validation = await activities.validateStagingActivity({
    ingestionRunId: input.ingestionRunId,
  });

  const crmDiff = await activities.reconcileCrmDiffActivity({
    ingestionRunId: input.ingestionRunId,
  });

  const warehouseDiff = await activities.reconcileWarehouseDiffActivity({
    ingestionRunId: input.ingestionRunId,
  });

  await activities.promoteRegistrySwapActivity({
    ingestionRunId: input.ingestionRunId,
  });

  const metadataSync = await activities.syncCrmMetadataActivity({
    ingestionRunId: input.ingestionRunId,
  });

  const facilityServicesSync = await activities.syncFacilityServicesActivity({
    ingestionRunId: input.ingestionRunId,
  });

  const stats = {
    reference,
    download,
    extracted,
    preflight,
    parsed,
    loaded,
    validation,
    crmDiff,
    warehouseDiff,
    metadataSync,
    facilityServicesSync,
  };

  await activities.finalizeIngestionRunActivity({
    ingestionRunId: input.ingestionRunId,
    stats,
  });

  const cleanup = await activities.cleanupPreviousArchiveActivity({
    ano: reference.ano,
    mes: reference.mes,
  });

  return {
    ingestionRunId: input.ingestionRunId,
    workflowId: workflowIdForReference(reference.ano, reference.mes),
    reference,
    stats: {
      ...stats,
      cleanup,
    },
  };
}
