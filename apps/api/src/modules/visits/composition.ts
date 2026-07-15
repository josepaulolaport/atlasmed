import { environment } from "@atlasmed/config";
import { RecordVisitUseCase, GetWeeklyVisitSummaryUseCase } from "./application/use-cases/visit.use-cases";
import { DrizzleVisitRepository } from "./infrastructure/repositories/drizzle/drizzle-visit.repository";

export const visitRepositories = { visit: new DrizzleVisitRepository() };
export const visitUseCases = {
  recordVisit: () => new RecordVisitUseCase({ visitRepository: visitRepositories.visit }),
  getWeeklySummary: () => new GetWeeklyVisitSummaryUseCase({
    visitRepository: visitRepositories.visit,
    timeZone: environment.APP_TIMEZONE,
  }),
};
