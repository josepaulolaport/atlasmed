import { DrizzleDashboardRepository } from "./infrastructure/repositories/drizzle-dashboard.repository";
import { DrizzleDashboardDirectoryRepository } from "./infrastructure/repositories/drizzle-dashboard-directory.repository";
import {
  GetAssignedClinicsMetricUseCase,
  GetCadastroCompletionMetricUseCase,
  GetCoverageMetricUseCase,
  GetDashboardTerritoryUseCase,
  GetFilterOptionsUseCase,
  GetOrdersMetricUseCase,
  GetPenetrationMetricUseCase,
  GetPurchaseBucketsMetricUseCase,
  GetUnassignedClinicsMetricUseCase,
  ListMetricClinicsUseCase,
} from "./application/use-cases/dashboard-metrics.use-cases";

import { DrizzleTeamRepository } from "./infrastructure/repositories/drizzle-team.repository";
import {
  GetMemberTerritoryMapUseCase,
  GetTeamMemberUseCase,
  ListAssignableClinicsUseCase,
  ListRepsWithoutPatchUseCase,
  ListTeamUseCase,
} from "./application/use-cases/team.use-cases";

const repository = new DrizzleDashboardRepository();
const directory = new DrizzleDashboardDirectoryRepository();
const teamRepository = new DrizzleTeamRepository();
const deps = { repository, directory };

export const dashboardUseCases = {
  getAssignedClinics: () => new GetAssignedClinicsMetricUseCase(deps),
  getCoverage: () => new GetCoverageMetricUseCase(deps),
  getPurchaseBuckets: () => new GetPurchaseBucketsMetricUseCase(deps),
  getCadastroCompletion: () => new GetCadastroCompletionMetricUseCase(deps),
  getOrders: () => new GetOrdersMetricUseCase(deps),
  getPenetration: () => new GetPenetrationMetricUseCase(deps),
  getUnassignedClinics: () => new GetUnassignedClinicsMetricUseCase(deps),
  getTerritory: () => new GetDashboardTerritoryUseCase(deps),
  listMetricClinics: () => new ListMetricClinicsUseCase(deps),
  getFilterOptions: () =>
    new GetFilterOptionsUseCase({
      ...deps,
      // The unit-type catalogue is owned by the facility module (spec 0014
      // item 14) and is deliberately not re-derived here: two lists of the same
      // catalogue would eventually disagree, and this one sits outside the
      // faceting anyway, so there is nothing to narrow it against.
      listUnitTypes: async () => {
        const { facilityUseCases } = await import("../facility/composition");
        const { data } = await facilityUseCases.listUnitTypes().execute();
        return data.map((row) => ({ id: row.id, label: row.name }));
      },
    }),
  listTeam: () =>
    new ListTeamUseCase({
      teamRepository,
      directory,
      metrics: {
        penetration: new GetPenetrationMetricUseCase(deps),
        unassignedClinics: new GetUnassignedClinicsMetricUseCase(deps),
      },
    }),
  getTeamMember: () => new GetTeamMemberUseCase({ teamRepository, directory }),
  listAssignableClinics: () =>
    new ListAssignableClinicsUseCase({ teamRepository, directory }),
  getMemberTerritoryMap: () =>
    new GetMemberTerritoryMapUseCase({ teamRepository, directory }),
  listRepsWithoutPatch: () => new ListRepsWithoutPatchUseCase({ teamRepository }),
};
