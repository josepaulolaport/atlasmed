import {
  getEmultecOrderWatermark,
  importEmultecOrdersPage,
  type ImportEmultecOrdersPageInput,
  type ImportEmultecOrdersPageResult,
} from "../emultec/import-emultec-orders";
import {
  finishEmultecImportRun,
  startEmultecImportRun,
  type EmultecImportRunStatus,
} from "../emultec/emultec-order-import-ops";
import { isEmultecMysqlConfigured } from "../emultec/emultec-mysql";

export async function isEmultecConfiguredActivity(): Promise<boolean> {
  return isEmultecMysqlConfigured();
}

export async function importEmultecOrdersPageActivity(
  input: ImportEmultecOrdersPageInput
): Promise<ImportEmultecOrdersPageResult> {
  return importEmultecOrdersPage(input);
}

export async function getEmultecOrderWatermarkActivity(): Promise<number> {
  return getEmultecOrderWatermark();
}

export async function startEmultecImportRunActivity(input: {
  mode: string;
  workflowId?: string | null;
  watermarkBefore?: number | null;
}): Promise<number> {
  return startEmultecImportRun(input);
}

export async function finishEmultecImportRunActivity(input: {
  runId: number;
  status: EmultecImportRunStatus;
  fetched: number;
  upserted: number;
  /** Of `upserted`, how many actually wrote a row. Log-only in the digest. */
  changed?: number;
  skipped: number;
  /** Best-effort `facility_emultec_clients` writes that failed. Normally 0. */
  linkFailures?: number;
  skipReasons: Record<string, number>;
  watermarkAfter?: number | null;
  errorMessage?: string | null;
}): Promise<void> {
  return finishEmultecImportRun(input);
}
