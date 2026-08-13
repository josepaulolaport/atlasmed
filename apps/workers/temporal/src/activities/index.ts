import { wrapActivity } from "../instrumentation/wrap-activity";

import { rebuildSearchIndexActivity as rebuildSearchIndexActivityImpl } from "./search-rebuild.activities";
import { sweepCadastroUploadsActivity as sweepCadastroUploadsActivityImpl } from "./cadastro-sweep.activities";
import {
  discoverCnesReferenceActivity as discoverCnesReferenceActivityImpl,
  ensureCnesArchiveActivity as ensureCnesArchiveActivityImpl,
  finishCnesRunActivity as finishCnesRunActivityImpl,
  ingestCnesRegistryActivity as ingestCnesRegistryActivityImpl,
  startCnesRunActivity as startCnesRunActivityImpl,
} from "./cnes-ingestion.activities";
import {
  logMetricSnapshotLifecycle as logMetricSnapshotLifecycleImpl,
  recalculateMetricSnapshotsBatch as recalculateMetricSnapshotsBatchImpl,
} from "./metric-snapshot.activities";

import {
  logPurchaseRecurrenceLifecycle as logPurchaseRecurrenceLifecycleImpl,
  recalculatePurchaseRecurrenceBatch as recalculatePurchaseRecurrenceBatchImpl,
} from "./purchase-recurrence.activities";
import {
  finishEmultecImportRunActivity as finishEmultecImportRunActivityImpl,
  getEmultecOrderWatermarkActivity as getEmultecOrderWatermarkActivityImpl,
  importEmultecOrdersPageActivity as importEmultecOrdersPageActivityImpl,
  isEmultecConfiguredActivity as isEmultecConfiguredActivityImpl,
  startEmultecImportRunActivity as startEmultecImportRunActivityImpl,
} from "./emultec-order-import.activities";

export const recalculatePurchaseRecurrenceBatch = wrapActivity(
  "recalculatePurchaseRecurrenceBatch",
  recalculatePurchaseRecurrenceBatchImpl
);

export const logPurchaseRecurrenceLifecycle = wrapActivity(
  "logPurchaseRecurrenceLifecycle",
  logPurchaseRecurrenceLifecycleImpl
);

export const rebuildSearchIndexActivity = wrapActivity(
  "rebuildSearchIndex",
  rebuildSearchIndexActivityImpl
);

export const importEmultecOrdersPageActivity = wrapActivity(
  "importEmultecOrdersPage",
  importEmultecOrdersPageActivityImpl
);

export const isEmultecConfiguredActivity = wrapActivity(
  "isEmultecConfigured",
  isEmultecConfiguredActivityImpl
);

export const getEmultecOrderWatermarkActivity = wrapActivity(
  "getEmultecOrderWatermark",
  getEmultecOrderWatermarkActivityImpl
);

export const startEmultecImportRunActivity = wrapActivity(
  "startEmultecImportRun",
  startEmultecImportRunActivityImpl
);

export const finishEmultecImportRunActivity = wrapActivity(
  "finishEmultecImportRun",
  finishEmultecImportRunActivityImpl
);

export const sweepCadastroUploadsActivity = wrapActivity(
  "sweepCadastroUploads",
  sweepCadastroUploadsActivityImpl
);

export const discoverCnesReferenceActivity = wrapActivity(
  "discoverCnesReference",
  discoverCnesReferenceActivityImpl
);

export const ensureCnesArchiveActivity = wrapActivity(
  "ensureCnesArchive",
  ensureCnesArchiveActivityImpl
);

export const startCnesRunActivity = wrapActivity(
  "startCnesRun",
  startCnesRunActivityImpl
);

export const ingestCnesRegistryActivity = wrapActivity(
  "ingestCnesRegistry",
  ingestCnesRegistryActivityImpl
);

export const finishCnesRunActivity = wrapActivity(
  "finishCnesRun",
  finishCnesRunActivityImpl
);

export const recalculateMetricSnapshotsBatch = wrapActivity(
  "recalculateMetricSnapshotsBatch",
  recalculateMetricSnapshotsBatchImpl
);

export const logMetricSnapshotLifecycle = wrapActivity(
  "logMetricSnapshotLifecycle",
  logMetricSnapshotLifecycleImpl
);
