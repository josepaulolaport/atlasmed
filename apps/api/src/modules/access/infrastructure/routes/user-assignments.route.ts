import { Elysia, t } from "elysia";
import { Role } from "@atlasmed/access";
import {
  assignUserTerritorySchema,
  replaceUserAssignmentsSchema,
} from "@atlasmed/access";
import { accessUseCases, accessRepositories, auth } from "../../composition";
import { requirePermission } from "../middleware/permission.middleware";

const userIdParams = t.Object({
  id: t.Number({ minimum: 1 }),
});

const userTerritoryParams = t.Object({
  id: t.Number({ minimum: 1 }),
  territoryId: t.Number({ minimum: 1 }),
});

const userVerticalParams = t.Object({
  id: t.Number({ minimum: 1 }),
  verticalId: t.Number({ minimum: 1 }),
});

const managerIdParams = t.Object({
  managerId: t.Number({ minimum: 1 }),
});

const territoryIdParams = t.Object({
  id: t.Number({ minimum: 1 }),
});

export const userAssignmentsRoute = new Elysia({
  detail: {
    tags: ["Users"],
  },
})
  .use(auth)
  .use(requirePermission("manage", "USER"))
  .post(
    "/users/:id/territories",
    async ({ params, body, getUserId, getUser }) => {
      const assignedBy = await getUserId();
      const actor = await getUser();
      const parsed = assignUserTerritorySchema.parse(body);

      await accessUseCases.assignUserTerritory().execute({
        targetUserId: params.id,
        territoryId: parsed.territoryId,
        assignedBy,
        actorRole: actor.role.name as Role,
      });

      return {
        message: "User territory assigned successfully",
      };
    },
    {
      params: userIdParams,
      body: t.Object({
        territoryId: t.Number({ minimum: 1 }),
      }),
    },
  )
  .delete(
    "/users/:id/territories/:territoryId",
    async ({ params, getUserId, getUser }) => {
      const revokedBy = await getUserId();
      const actor = await getUser();

      await accessUseCases.revokeUserTerritory().execute({
        targetUserId: params.id,
        territoryId: params.territoryId,
        revokedBy,
        actorRole: actor.role.name as Role,
      });

      return {
        message: "User territory revoked successfully",
      };
    },
    {
      params: userTerritoryParams,
    },
  )
  .post(
    "/users/:id/verticals",
    async ({ params, body, getUserId }) => {
      const assignedByUserId = await getUserId();

      await accessRepositories.scope.assignVertical({
        userId: params.id,
        verticalId: (body as { verticalId: number }).verticalId,
        assignedByUserId,
      });

      return { message: "Business vertical assigned successfully" };
    },
    {
      params: userIdParams,
      body: t.Object({
        verticalId: t.Number({
          minimum: 1,
          description: "Business vertical ID to assign to the user",
        }),
        managerId: t.Optional(
          t.Union([t.Number({ minimum: 1 }), t.Null()], {
            description: "Per-vertical reporting manager (REP)",
          }),
        ),
      }),
    },
  )
  .delete(
    "/users/:id/verticals/:verticalId",
    async ({ params, getUserId }) => {
      await getUserId();

      await accessRepositories.scope.revokeVertical({
        userId: params.id,
        verticalId: params.verticalId,
      });

      return { message: "Business vertical revoked successfully" };
    },
    {
      params: userVerticalParams,
    },
  )
  .get(
    "/users/:id/assignments",
    async ({ params, getUser }) => {
      const actor = await getUser();
      return accessUseCases.getUserAssignments().execute({
        targetUserId: params.id,
        actorRole: actor.role.name as Role,
      });
    },
    {
      detail: {
        summary: "Get assignments for a user (admin)",
        description:
          "Returns invite-shaped per-vertical manager + territory assignments with map boundaries.",
        tags: ["Users"],
        security: [{ bearerAuth: [] }],
      },
      params: userIdParams,
    },
  )
  .put(
    "/users/:id/assignments",
    async ({ params, body, getUserId, getUser }) => {
      const actor = await getUser();
      const assignedBy = await getUserId();
      const parsed = replaceUserAssignmentsSchema.parse(body);

      return accessUseCases.replaceUserAssignments().execute({
        targetUserId: params.id,
        actorUserId: assignedBy,
        actorRole: actor.role.name as Role,
        verticalAssignments: parsed.verticalAssignments.map((v) => ({
          verticalId: v.verticalId,
          territoryIds: v.territoryIds,
        })),
      });
    },
    {
      detail: {
        summary: "Replace user vertical/territory assignments",
        tags: ["Users"],
        security: [{ bearerAuth: [] }],
      },
      params: userIdParams,
      body: t.Object({
        verticalAssignments: t.Array(
          t.Object({
            verticalId: t.Number({ minimum: 1 }),
            territoryIds: t.Array(t.Number({ minimum: 1 })),
          }),
        ),
      }),
    },
  )
  .get(
    "/managers/:managerId/assignable-territories",
    async ({ params, query, getUser }) => {
      const actor = await getUser();
      return accessUseCases.getAssignableTerritoriesForManager().execute({
        managerId: params.managerId,
        verticalId: query.verticalId,
        actorRole: actor.role.name as Role,
      });
    },
    {
      detail: {
        summary: "List assignable rep patches under a manager",
        tags: ["Users"],
        security: [{ bearerAuth: [] }],
      },
      params: managerIdParams,
      query: t.Object({
        verticalId: t.Number({ minimum: 1, description: "Business vertical ID" }),
      }),
    },
  )
  .use(requirePermission("read", "TERRITORY"))
  .get(
    "/territories/:id/assignments",
    async ({ params }) => {
      return accessUseCases.getTerritoryAssignments().execute(params.id);
    },
    {
      params: territoryIdParams,
    },
  );
