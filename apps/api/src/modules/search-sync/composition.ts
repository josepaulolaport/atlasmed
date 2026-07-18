import {
  describeSearchSyncWorkflow,
  startFullSearchSyncWorkflow,
} from "../../infrastructure/temporal/temporal.client";
import {
  GetSearchSyncStatusUseCase,
  StartSearchSyncUseCase,
} from "./application/use-cases/search-sync.use-case";

export const searchSyncUseCases = {
  start: () => new StartSearchSyncUseCase({ start: startFullSearchSyncWorkflow }),
  status: () => new GetSearchSyncStatusUseCase({ describe: describeSearchSyncWorkflow }),
};
