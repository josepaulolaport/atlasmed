import {
  describeSearchSyncWorkflow,
  startEmultecOrderImportWorkflow,
  startFullSearchSyncWorkflow,
  startPurchaseRecurrenceBackfillWorkflow,
} from "../../infrastructure/temporal/temporal.client";
import {
  GetSearchSyncStatusUseCase,
  StartSearchSyncUseCase,
} from "./application/use-cases/search-sync.use-case";

export const searchSyncUseCases = {
  start: () => new StartSearchSyncUseCase({
    start: startFullSearchSyncWorkflow,
    startOrdersBackfill: startPurchaseRecurrenceBackfillWorkflow,
    startEmultecOrderImport: startEmultecOrderImportWorkflow,
  }),
  status: () => new GetSearchSyncStatusUseCase({ describe: describeSearchSyncWorkflow }),
};
