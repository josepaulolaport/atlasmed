import { Elysia, t } from "elysia";
import { auth } from "../../../access/composition";
import { requirePermission } from "../../../access/infrastructure/middleware/permission.middleware";
import { dashboardUseCases } from "../../composition";
import type { TeamSortKey } from "../../application/use-cases/team.use-cases";

/**
 * Equipe (spec 0014 §6) — the roster, and the entry point to a person's
 * Desempenho.
 *
 * Lives in the dashboard module rather than in `access` because a row's values
 * are **metrics**: every row carries clínicas, cobertura, cadastro and pedidos,
 * computed for the whole roster in one pass against the same definitions the
 * Desempenho screen uses. Splitting it would mean two definitions of coverage.
 * The existing `/users` admin surface is unrelated and stays where it is
 * (spec 0014 §2).
 */
const SORT_KEYS: TeamSortKey[] = [
  "name",
  "assigned-clinics",
  "coverage",
  "cadastro-completion",
  "orders-month",
  "penetration",
  "unassigned-clinics",
];

type Executable = { execute(input: never): Promise<unknown> };

export interface TeamHttpUseCases {
  listTeam(): Executable;
  getTeamMember(): Executable;
  listAssignableClinics(): Executable;
  listRepsWithoutPatch(): Executable;
}

const teamRoutes = (useCases: TeamHttpUseCases, authPlugin: typeof auth) =>
  new Elysia({ prefix: "/team" })
    .use(authPlugin)
    .use(requirePermission("read", "USER"))
    // Declared before `""` on purpose: a literal segment must not be shadowed
    // by the roster route.
    .get(
      "/reps-without-patch",
      async ({ getUser }) => {
        const actor = await getUser();
        return useCases
          .listRepsWithoutPatch()
          .execute({ viewerRole: actor.role.name } as never);
      },
      {
        detail: {
          summary:
            "REPs with no active patch — no manager, no team, no clinics (spec 0009 R8)",
          tags: ["Dashboard"],
          security: [{ bearerAuth: [] }],
        },
      },
    )
    // Also before `""`, for the same reason.
    .get(
      "/members/:userId",
      async ({ params, query, getScope, getUser }) => {
        const actor = await getUser();
        const scope = await getScope();
        return useCases.getTeamMember().execute({
          viewerId: actor.id,
          viewerRole: actor.role.name,
          scope,
          subjectUserId: params.userId,
          verticalId: query.verticalId ?? null,
        } as never);
      },
      {
        detail: {
          summary:
            "One team member — identity, territories and clinic counts in the reader's scope",
          tags: ["Dashboard"],
          security: [{ bearerAuth: [] }],
        },
        params: t.Object({ userId: t.Number({ minimum: 1 }) }),
        query: t.Object({
          verticalId: t.Optional(t.Number({ minimum: 1 })),
        }),
      },
    )
    .get(
      "/members/:userId/assignable-clinics",
      async ({ params, query, getScope, getUser }) => {
        const actor = await getUser();
        const scope = await getScope();
        return useCases.listAssignableClinics().execute({
          viewerId: actor.id,
          viewerRole: actor.role.name,
          scope,
          subjectUserId: params.userId,
          verticalId: query.verticalId ?? null,
          mode: query.mode ?? "patch",
          search: query.search ?? null,
          page: query.page,
          limit: query.limit,
        } as never);
      },
      {
        detail: {
          summary:
            "Clinics this rep could take — inside their patches, or anywhere with a reason (spec 0015 R6)",
          tags: ["Dashboard"],
          security: [{ bearerAuth: [] }],
        },
        params: t.Object({ userId: t.Number({ minimum: 1 }) }),
        query: t.Object({
          verticalId: t.Optional(t.Number({ minimum: 1 })),
          mode: t.Optional(
            t.Union([t.Literal("patch"), t.Literal("search")]),
          ),
          search: t.Optional(t.String()),
          page: t.Optional(t.Number({ minimum: 1 })),
          limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
        }),
      },
    )
    .get(
      "",
      async ({ query, getScope, getUser }) => {
        const actor = await getUser();
        const scope = await getScope();
        return useCases.listTeam().execute({
          viewerId: actor.id,
          viewerRole: actor.role.name,
          scope,
          verticalId: query.verticalId ?? null,
          managerId: query.managerId ?? null,
          sortBy: query.sortBy as TeamSortKey | undefined,
          order: query.order as "asc" | "desc" | undefined,
        } as never);
      },
      {
        detail: {
          summary:
            "Equipe — a manager's reps, or (ADMIN) managers and one manager's team",
          tags: ["Dashboard"],
          security: [{ bearerAuth: [] }],
        },
        query: t.Object({
          verticalId: t.Optional(t.Number({ minimum: 1 })),
          managerId: t.Optional(t.Number({ minimum: 1 })),
          sortBy: t.Optional(t.Union(SORT_KEYS.map((key) => t.Literal(key)))),
          order: t.Optional(t.Union([t.Literal("asc"), t.Literal("desc")])),
        }),
      },
    );

export function createTeamRoutes(
  useCases: TeamHttpUseCases = dashboardUseCases,
  authPlugin: typeof auth = auth,
) {
  return teamRoutes(useCases, authPlugin);
}

export const teamRoute = createTeamRoutes();
