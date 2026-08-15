import {
  CompleteInteractionUseCase,
  GetInteractionUseCase,
  CloseStaleVisitsUseCase,
  RecordInteractionOutcomeUseCase,
  MarkOverdueInteractionsUseCase,
  StartInteractionUseCase,
} from "./application/use-cases/interaction.use-cases";
import { DrizzleInteractionRepository } from "./infrastructure/repositories/drizzle/drizzle-interaction.repository";

export const interactionRepositories = { interaction: new DrizzleInteractionRepository() };
export const interactionUseCases = {
  get: () => new GetInteractionUseCase({ repository: interactionRepositories.interaction }),
  start: () => new StartInteractionUseCase({ repository: interactionRepositories.interaction }),
  complete: () => new CompleteInteractionUseCase({ repository: interactionRepositories.interaction }),
  markOverdue: () => new MarkOverdueInteractionsUseCase({ repository: interactionRepositories.interaction }),
  closeStaleVisits: () => new CloseStaleVisitsUseCase({ repository: interactionRepositories.interaction }),
  recordOutcome: () => new RecordInteractionOutcomeUseCase({ repository: interactionRepositories.interaction }),
};
