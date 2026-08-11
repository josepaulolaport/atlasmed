import { Elysia, t } from "elysia";
import { auth } from "../../../access/composition";
import { requirePermission } from "../../../access/infrastructure/middleware/permission.middleware";
import { dashboardUseCases } from "../../composition";
import type { TeamSortKey } from "../../application/use-cases/team.use-cases";

/**
 * Equipe (spec 0014 §6) — the roster, and the entry point to a person's
 * Desempenho.
 *
 * Lives in the dashboard module rather than in `access` because a row's value
 * is a **metric**: sorting by one computes it per member through the same use
 * cases the screen uses. Splitting it would mean two definitions of coverage.
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

export const teamRoute = new Elysia({ prefix: "/team" })
  .use(auth)
  .use(requirePermission("read", "USER"))
  .get(
    "/reps-without-patch",
    async ({ getUser }) => {
      const actor = await getUser();
      return dashboardUseCases
        .listRepsWithoutPatch()
        .execute({ viewerRole: actor.role.name });
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
  .get(
    "",
    async ({ query, getScope, getUser }) => {
      const actor = await getUser();
      const scope = await getScope();
      return dashboardUseCases.listTeam().execute({
        viewerId: actor.id,
        viewerRole: actor.role.name,
        scope,
        verticalId: query.verticalId ?? null,
        managerId: query.managerId ?? null,
        sortBy: query.sortBy as TeamSortKey | undefined,
        order: query.order as "asc" | "desc" | undefined,
      });
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
