import { environment } from "@atlasmed/config";
import { RecordInteractionUseCase, GetWeeklyInteractionSummaryUseCase } from "./application/use-cases/interaction.use-cases";
import { DrizzleInteractionRepository } from "./infrastructure/repositories/drizzle/drizzle-interaction.repository";

export const interactionRepositories = { interaction: new DrizzleInteractionRepository() };
export const interactionUseCases = {
  recordInteraction: () => new RecordInteractionUseCase({ interactionRepository: interactionRepositories.interaction }),
  getWeeklySummary: () => new GetWeeklyInteractionSummaryUseCase({
    interactionRepository: interactionRepositories.interaction,
    timeZone: environment.APP_TIMEZONE,
  }),
};
