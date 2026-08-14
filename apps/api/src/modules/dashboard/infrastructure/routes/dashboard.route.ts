import { Elysia, t } from "elysia";
import { auth } from "../../../access/composition";
import { requirePermission } from "../../../access/infrastructure/middleware/permission.middleware";
import { dashboardUseCases } from "../../composition";
import type {
  DashboardMetricKey,
  DashboardMetricRequest,
} from "../../application/use-cases/dashboard-metrics.use-cases";

/**
 * Every metric is its own endpoint (spec 0014 §4), taking the same scope +
 * filter parameters, independently cacheable and independently able to fail.
 * The screen renders skeletons and fills them as they arrive.
 *
 * This replaces `GET /dashboard/summary`, which blocked on its slowest query
 * and returned a cross-vertical national aggregate to every ADMIN.
 */
/**
 * Filters are multi-select (spec 0014 §5), so each arrives as a comma-separated
 * list. The singular forms are kept beside them and merged: they are what
 * shipped, installed mobile builds still send them, and dropping them would make
 * every already-installed app filter by nothing at all — silently.
 */
const idList = t.Optional(t.String({ pattern: "^[0-9]+(,[0-9]+)*$" }));

const metricQuery = t.Object({
  verticalId: t.Optional(t.Number({ minimum: 1 })),
  /** Spec 0014 §2: whose desempenho. Omitted means the caller's own. */
  subjectUserId: t.Optional(t.Number({ minimum: 1 })),
  /**
   * Spec 0015 R2: the manager whose team this subject was reached through.
   *
   * Deliberately not the `managerId` **filter** below, which expresses the same
   * predicate but is user-visible and clearable — dropping a filter chip would
   * silently change who the numbers are about. This is structural: it says
   * which share of a person the reader is looking at, and only an admin can
   * send it. A manager's own constraint is derived from their identity.
   */
  withinManagerId: t.Optional(t.Number({ minimum: 1 })),
  unitTypeId: t.Optional(t.Number({ minimum: 1 })),
  managerId: t.Optional(t.Number({ minimum: 1 })),
  repId: t.Optional(t.Number({ minimum: 1 })),
  stateId: t.Optional(t.Number({ minimum: 1 })),
  municipalityId: t.Optional(t.Number({ minimum: 1 })),
  unitTypeIds: idList,
  managerIds: idList,
  repIds: idList,
  stateIds: idList,
  municipalityIds: idList,
});

type MetricQuery = {
  verticalId?: number;
  subjectUserId?: number;
  withinManagerId?: number;
  unitTypeId?: number;
  managerId?: number;
  repId?: number;
  stateId?: number;
  municipalityId?: number;
  unitTypeIds?: string;
  managerIds?: string;
  repIds?: string;
  stateIds?: string;
  municipalityIds?: string;
};

/** The pattern above guarantees digits, so this cannot produce NaN. */
function idsOf(raw: string | undefined): number[] | null {
  if (!raw) return null;
  return raw.split(",").map(Number);
}

function toRequest(
  query: MetricQuery,
  actor: { id: number; role: { name: string } },
  scope: DashboardMetricRequest["scope"],
): DashboardMetricRequest {
  return {
    viewerId: actor.id,
    viewerRole: actor.role.name,
    scope,
    verticalId: query.verticalId ?? null,
    subjectUserId: query.subjectUserId ?? null,
    withinManagerId: query.withinManagerId ?? null,
    filters: {
      unitTypeId: query.unitTypeId ?? null,
      managerId: query.managerId ?? null,
      repId: query.repId ?? null,
      stateId: query.stateId ?? null,
      municipalityId: query.municipalityId ?? null,
      unitTypeIds: idsOf(query.unitTypeIds),
      managerIds: idsOf(query.managerIds),
      repIds: idsOf(query.repIds),
      stateIds: idsOf(query.stateIds),
      municipalityIds: idsOf(query.municipalityIds),
    },
  };
}

const METRIC_KEYS: DashboardMetricKey[] = [
  "assigned-clinics",
  "coverage",
  "cadastro-completion",
  "unassigned-clinics",
  "bucket-active",
  "bucket-inactive",
  "bucket-never-bought",
];

type Executable = { execute(input: never): Promise<unknown> };

/**
 * The use cases these routes need, as an injectable contract.
 *
 * Taking them as an argument rather than importing `composition` at module load
 * is what makes the routes mountable in a test — the pattern `orders.route.ts`
 * established. Without it the only coverage possible was unit-level, which is
 * how `GET /dashboard/metrics/orders` shipped as a 500 that no test could see
 * (spec 0014 §8.2).
 */
export interface DashboardHttpUseCases {
  getAssignedClinics(): Executable;
  getCoverage(): Executable;
  getPurchaseBuckets(): Executable;
  getCadastroCompletion(): Executable;
  getOrders(): Executable;
  getPenetration(): Executable;
  getUnassignedClinics(): Executable;
  getTerritory(): Executable;
  getFilterOptions(): Executable;
  listMetricClinics(): Executable;
}

/**
 * The seven metric endpoints, plus the territory card.
 *
 * Each is the same three steps — resolve the actor, collapse query into a
 * request, hand it to one use case — so they are declared as data rather than
 * written out eight times. A metric that forgot `toRequest` would answer for a
 * scope nobody asked for, and there is no way to forget it here.
 */
const METRIC_ENDPOINTS: Array<{
  path: string;
  useCase: keyof DashboardHttpUseCases;
  summary: string;
}> = [
  {
    path: "/metrics/assigned-clinics",
    useCase: "getAssignedClinics",
    summary: "Clínicas atribuídas — profiles in the caller's scope",
  },
  {
    path: "/metrics/coverage",
    useCase: "getCoverage",
    summary: "Cobertura — clinics that have ever bought, over the denominator",
  },
  {
    path: "/metrics/purchase-buckets",
    useCase: "getPurchaseBuckets",
    summary: "Distribuição por bucket do funil de compra",
  },
  {
    path: "/metrics/cadastro-completion",
    useCase: "getCadastroCompletion",
    summary: "Taxa de cadastro completo (conformity_status = REGISTERED)",
  },
  {
    path: "/metrics/orders",
    useCase: "getOrders",
    summary: "Pedidos — counts for the trailing week and the current month",
  },
  {
    path: "/metrics/penetration",
    useCase: "getPenetration",
    summary:
      "Penetração média por métrica — mean share across clinics where it is calculated",
  },
  {
    path: "/metrics/unassigned-clinics",
    useCase: "getUnassignedClinics",
    summary:
      "Clínicas não atribuídas — in scope with no active rep (manager/admin)",
  },
  {
    path: "/territory",
    useCase: "getTerritory",
    summary: "Territory card — boundaries and headline counts for the scope",
  },
  {
    path: "/filter-options",
    useCase: "getFilterOptions",
    summary:
      "Options each filter drawer can offer, given the scope and the other filters",
  },
];

const dashboardMetricRoutes = (
  useCases: DashboardHttpUseCases,
  authPlugin: typeof auth,
) => {
  let routes = new Elysia({ prefix: "/dashboard" })
    .use(authPlugin)
    .use(requirePermission("read", "FACILITY"));

  for (const endpoint of METRIC_ENDPOINTS) {
    routes = routes.get(
      endpoint.path,
      async ({ query, getScope, getUser }) =>
        useCases[endpoint.useCase]().execute(
          toRequest(query, await getUser(), await getScope()) as never,
        ),
      {
        detail: {
          summary: endpoint.summary,
          tags: ["Dashboard"],
          security: [{ bearerAuth: [] }],
        },
        query: metricQuery,
      },
    ) as typeof routes;
  }

  return routes.get(
    "/metrics/:metric/clinics",
    async ({ params, query, getScope, getUser }) => {
      const metric = params.metric as DashboardMetricKey;
      return useCases.listMetricClinics().execute({
        ...toRequest(query, await getUser(), await getScope()),
        metric,
        page: query.page ?? 1,
        limit: query.limit ?? 25,
      } as never);
    },
    {
      detail: {
        summary: "Per-clinic breakdown behind a metric card (spec 0014 §4.1)",
        tags: ["Dashboard"],
        security: [{ bearerAuth: [] }],
      },
      params: t.Object({
        metric: t.Union(METRIC_KEYS.map((key) => t.Literal(key))),
      }),
      query: t.Composite([
        metricQuery,
        t.Object({
          page: t.Optional(t.Number({ minimum: 1 })),
          limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
        }),
      ]),
    },
  );
};

export function createDashboardRoutes(
  useCases: DashboardHttpUseCases = dashboardUseCases,
  authPlugin: typeof auth = auth,
) {
  return dashboardMetricRoutes(useCases, authPlugin);
}

export const dashboardRoute = createDashboardRoutes();
