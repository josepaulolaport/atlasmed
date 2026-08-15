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
  GetCpfIssuesMetricUseCase,
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
  getCpfIssues: () => new GetCpfIssuesMetricUseCase(deps),
  getCadastroCompletion: () => new GetCadastroCompletionMetricUseCase(deps),
  getOrders: () => new GetOrdersMetricUseCase(deps),
  getPenetration: () => new GetPenetrationMetricUseCase(deps),
  getUnassignedClinics: () => new GetUnassignedClinicsMetricUseCase(deps),
  getTerritory: () => new GetDashboardTerritoryUseCase(deps),
  listMetricClinics: () =>
    new ListMetricClinicsUseCase({
      ...deps,
      // Explorar's own list payload, through Explorar's own serialiser — the
      // same route the unit-type catalogue above takes, and for the same
      // reason: a second description of a clinic would eventually disagree
      // with the first. Scope is already settled by the time we get here, so
      // the hydration runs unrestricted over exactly the ids this module chose.
      hydration: {
        listByIds: async ({ ids, verticalId, userId }) => {
          if (ids.length === 0) return [];
          const [{ facilityRepositories }, { serializeFacility }] =
            await Promise.all([
              import("../facility/composition"),
              import("../facility/application/mappers/facility.mapper"),
            ]);
          const records = await facilityRepositories.facility.findAllByIds({
            ids,
            userId,
            scope: { isGlobal: true, facilityIds: ids },
          });
          return records.map((record) =>
            serializeFacility(record, [verticalId]),
          );
        },
      },
    }),
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
  getTeamMember: () =>
    new GetTeamMemberUseCase({
      teamRepository,
      directory,
      metrics: {
        assignedClinics: new GetAssignedClinicsMetricUseCase(deps),
        unassignedClinics: new GetUnassignedClinicsMetricUseCase(deps),
      },
    }),
  listAssignableClinics: () =>
    new ListAssignableClinicsUseCase({ teamRepository, directory }),
  getMemberTerritoryMap: () =>
    new GetMemberTerritoryMapUseCase({ teamRepository, directory }),
  listRepsWithoutPatch: () => new ListRepsWithoutPatchUseCase({ teamRepository }),
};
