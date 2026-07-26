import { DrizzleDashboardRepository } from "./infrastructure/repositories/drizzle-dashboard.repository";
import { GetDashboardSummaryUseCase } from "./application/get-dashboard-summary.use-case";

const dashboardRepository = new DrizzleDashboardRepository();

export const dashboardUseCases = {
  getSummary: () => new GetDashboardSummaryUseCase(dashboardRepository),
};
