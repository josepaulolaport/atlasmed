import { wrapActivity } from "../instrumentation/wrap-activity";

import { rebuildSearchIndexActivity as rebuildSearchIndexActivityImpl } from "./search-rebuild.activities";
import { processCadastroFileUploadedActivity as processCadastroFileUploadedActivityImpl } from "./cadastro-file-processing.activities";

import {
  logPurchaseRecurrenceLifecycle as logPurchaseRecurrenceLifecycleImpl,
  recalculatePurchaseRecurrenceBatch as recalculatePurchaseRecurrenceBatchImpl,
} from "./purchase-recurrence.activities";
import { importEmultecOrdersPageActivity as importEmultecOrdersPageActivityImpl } from "./emultec-order-import.activities";

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

export const processCadastroFileUploadedActivity = wrapActivity(
  "processCadastroFileUploaded",
  processCadastroFileUploadedActivityImpl
);

export const importEmultecOrdersPageActivity = wrapActivity(
  "importEmultecOrdersPage",
  importEmultecOrdersPageActivityImpl
);
