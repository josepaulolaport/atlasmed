import { Elysia, t } from "elysia";
import { Role } from "@atlasmed/access";
import {
  assignUserTerritorySchema,
  replaceUserAssignmentsSchema,
} from "@atlasmed/access";
import { accessUseCases, accessRepositories, auth } from "../../composition";
import { requirePermission } from "../middleware/permission.middleware";

export const userAssignmentsRoute = new Elysia({
  detail: {
    tags: ["Users"],
  },
})
  .use(auth)
  .use(requirePermission("manage", "USER"))
  .post(
    "/users/:id/territories",
    async ({ params, body, getUserId, getUser }: any) => {
      const assignedBy = await getUserId();
      const actor = await getUser();
      const parsed = assignUserTerritorySchema.parse(body);

      await accessUseCases.assignUserTerritory().execute({
        targetUserId: Number(params.id),
        territoryId: Number(parsed.territoryId),
        assignedBy,
        actorRole: actor.role.name,
      });

      return {
        message: "User territory assigned successfully",
      };
    },
    {
      body: t.Object({
        territoryId: t.String(),
      }),
    },
  )
  .delete(
    "/users/:id/territories/:territoryId",
    async ({ params, getUserId, getUser }: any) => {
      const revokedBy = await getUserId();
      const actor = await getUser();

      await accessUseCases.revokeUserTerritory().execute({
        targetUserId: Number(params.id),
        territoryId: Number(params.territoryId),
        revokedBy,
        actorRole: actor.role.name,
      });

      return {
        message: "User territory revoked successfully",
      };
    },
  )
  .post(
    "/users/:id/verticals",
    async ({ params, body, getUserId }: any) => {
      const assignedByUserId = await getUserId();

      await accessRepositories.scope.assignVertical({
        userId: Number(params.id),
        verticalId: Number((body as any).verticalId),
        assignedByUserId,
      });

      return { message: "Business vertical assigned successfully" };
    },
    {
      body: t.Object({
        verticalId: t.String({ description: "Business vertical ID to assign to the user" }),
        managerId: t.Optional(
          t.Union([t.String(), t.Null()], {
            description: "Per-vertical reporting manager (REP)",
          }),
        ),
      }),
    },
  )
  .delete(
    "/users/:id/verticals/:verticalId",
    async ({ params, getUserId }: any) => {
      await getUserId();

      await accessRepositories.scope.revokeVertical({
        userId: Number(params.id),
        verticalId: Number(params.verticalId),
      });

      return { message: "Business vertical revoked successfully" };
    },
  )
  .get(
    "/users/:id/assignments",
    async ({ params, getUser }: any) => {
      const actor = await getUser();
      return accessUseCases.getUserAssignments().execute({
        targetUserId: Number(params.id),
        actorRole: actor.role.name,
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
    },
  )
  .put(
    "/users/:id/assignments",
    async ({ params, body, getUserId, getUser }: any) => {
      const actor = await getUser();
      const assignedBy = await getUserId();
      const parsed = replaceUserAssignmentsSchema.parse(body);

      return accessUseCases.replaceUserAssignments().execute({
        targetUserId: Number(params.id),
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
      body: t.Object({
        verticalAssignments: t.Array(
          t.Object({
            verticalId: t.String(),
            territoryIds: t.Array(t.String()),
          }),
        ),
      }),
    },
  )
  .get(
    "/managers/:managerId/assignable-territories",
    async ({ params, query, getUser }: any) => {
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
      query: t.Object({
        verticalId: t.String({ description: "Business vertical ID" }),
      }),
    },
  )
  .use(requirePermission("read", "TERRITORY"))
  .get(
    "/territories/:id/assignments",
    async ({ params }: any) => {
      return accessUseCases.getTerritoryAssignments().execute(params.id);
    },
  );
