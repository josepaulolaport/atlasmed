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
const metricQuery = t.Object({
  verticalId: t.Optional(t.Number({ minimum: 1 })),
  /** Spec 0014 §2: whose desempenho. Omitted means the caller's own. */
  subjectUserId: t.Optional(t.Number({ minimum: 1 })),
  unitTypeId: t.Optional(t.Number({ minimum: 1 })),
  managerId: t.Optional(t.Number({ minimum: 1 })),
  repId: t.Optional(t.Number({ minimum: 1 })),
  stateId: t.Optional(t.Number({ minimum: 1 })),
  municipalityId: t.Optional(t.Number({ minimum: 1 })),
});

type MetricQuery = {
  verticalId?: number;
  subjectUserId?: number;
  unitTypeId?: number;
  managerId?: number;
  repId?: number;
  stateId?: number;
  municipalityId?: number;
};

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
    filters: {
      unitTypeId: query.unitTypeId ?? null,
      managerId: query.managerId ?? null,
      repId: query.repId ?? null,
      stateId: query.stateId ?? null,
      municipalityId: query.municipalityId ?? null,
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

export const dashboardRoute = new Elysia({ prefix: "/dashboard" })
  .use(auth)
  .use(requirePermission("read", "FACILITY"))
  .get(
    "/metrics/assigned-clinics",
    async ({ query, getScope, getUser }) =>
      dashboardUseCases
        .getAssignedClinics()
        .execute(toRequest(query, await getUser(), await getScope())),
    {
      detail: {
        summary: "Clínicas atribuídas — profiles in the caller's scope",
        tags: ["Dashboard"],
        security: [{ bearerAuth: [] }],
      },
      query: metricQuery,
    },
  )
  .get(
    "/metrics/coverage",
    async ({ query, getScope, getUser }) =>
      dashboardUseCases
        .getCoverage()
        .execute(toRequest(query, await getUser(), await getScope())),
    {
      detail: {
        summary: "Cobertura — clinics that have ever bought, over the denominator",
        tags: ["Dashboard"],
        security: [{ bearerAuth: [] }],
      },
      query: metricQuery,
    },
  )
  .get(
    "/metrics/purchase-buckets",
    async ({ query, getScope, getUser }) =>
      dashboardUseCases
        .getPurchaseBuckets()
        .execute(toRequest(query, await getUser(), await getScope())),
    {
      detail: {
        summary: "Distribuição por bucket do funil de compra",
        tags: ["Dashboard"],
        security: [{ bearerAuth: [] }],
      },
      query: metricQuery,
    },
  )
  .get(
    "/metrics/cadastro-completion",
    async ({ query, getScope, getUser }) =>
      dashboardUseCases
        .getCadastroCompletion()
        .execute(toRequest(query, await getUser(), await getScope())),
    {
      detail: {
        summary: "Taxa de cadastro completo (conformity_status = REGISTERED)",
        tags: ["Dashboard"],
        security: [{ bearerAuth: [] }],
      },
      query: metricQuery,
    },
  )
  .get(
    "/metrics/orders",
    async ({ query, getScope, getUser }) =>
      dashboardUseCases
        .getOrders()
        .execute(toRequest(query, await getUser(), await getScope())),
    {
      detail: {
        summary: "Pedidos — counts for the trailing week and the current month",
        tags: ["Dashboard"],
        security: [{ bearerAuth: [] }],
      },
      query: metricQuery,
    },
  )
  .get(
    "/metrics/penetration",
    async ({ query, getScope, getUser }) =>
      dashboardUseCases
        .getPenetration()
        .execute(toRequest(query, await getUser(), await getScope())),
    {
      detail: {
        summary:
          "Penetração média por métrica — mean share across clinics where it is calculated",
        tags: ["Dashboard"],
        security: [{ bearerAuth: [] }],
      },
      query: metricQuery,
    },
  )
  .get(
    "/metrics/unassigned-clinics",
    async ({ query, getScope, getUser }) =>
      dashboardUseCases
        .getUnassignedClinics()
        .execute(toRequest(query, await getUser(), await getScope())),
    {
      detail: {
        summary: "Clínicas não atribuídas — in scope with no active rep (manager/admin)",
        tags: ["Dashboard"],
        security: [{ bearerAuth: [] }],
      },
      query: metricQuery,
    },
  )
  .get(
    "/territory",
    async ({ query, getScope, getUser }) =>
      dashboardUseCases
        .getTerritory()
        .execute(toRequest(query, await getUser(), await getScope())),
    {
      detail: {
        summary: "Territory card — boundaries and headline counts for the scope",
        tags: ["Dashboard"],
        security: [{ bearerAuth: [] }],
      },
      query: metricQuery,
    },
  )
  .get(
    "/metrics/:metric/clinics",
    async ({ params, query, getScope, getUser }) => {
      const metric = params.metric as DashboardMetricKey;
      return dashboardUseCases.listMetricClinics().execute({
        ...toRequest(query, await getUser(), await getScope()),
        metric,
        page: query.page ?? 1,
        limit: query.limit ?? 25,
      });
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
