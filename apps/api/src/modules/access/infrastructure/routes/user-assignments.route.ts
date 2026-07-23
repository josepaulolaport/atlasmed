import { Elysia, t } from "elysia";
import { Role } from "@atlasmed/access";
import {
  assignUserManagerSchema,
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
  .patch(
    "/users/:id/manager",
    async ({ params, body, getUserId, getUser }: any) => {
      const assignedBy = await getUserId();
      const actor = await getUser();
      const parsed = assignUserManagerSchema.parse(body);

      await accessUseCases.assignUserManager().execute({
        targetUserId: params.id,
        managerId: parsed.managerId,
        assignedBy,
        actorRole: actor.role.name,
      });

      return {
        message: parsed.managerId
          ? "User manager assigned successfully"
          : "User manager removed successfully",
      };
    },
    {
      body: t.Object({
        managerId: t.Union([t.String(), t.Null()]),
      }),
    },
  )
  .post(
    "/users/:id/territories",
    async ({ params, body, getUserId, getUser }: any) => {
      const assignedBy = await getUserId();
      const actor = await getUser();
      const parsed = assignUserTerritorySchema.parse(body);

      await accessUseCases.assignUserTerritory().execute({
        targetUserId: params.id,
        territoryId: parsed.territoryId,
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
        targetUserId: params.id,
        territoryId: params.territoryId,
        revokedBy,
        actorRole: actor.role.name,
      });

      return {
        message: "User territory revoked successfully",
      };
    },
  )
  .post(
    "/users/:id/sectors",
    async ({ params, body, getUserId }: any) => {
      const assignedByUserId = await getUserId();

      await accessRepositories.scope.assignSector({
        userId: params.id,
        sectorId: (body as any).sectorId,
        assignedByUserId,
        managerId: (body as any).managerId ?? null,
      });

      return { message: "Sector assigned successfully" };
    },
    {
      body: t.Object({
        sectorId: t.String({ description: "Sector ID to assign to the user" }),
        managerId: t.Optional(
          t.Union([t.String(), t.Null()], {
            description: "Per-sector reporting manager (REP)",
          }),
        ),
      }),
    },
  )
  .delete(
    "/users/:id/sectors/:sectorId",
    async ({ params, getUserId }: any) => {
      await getUserId();

      await accessRepositories.scope.revokeSector({
        userId: params.id,
        sectorId: params.sectorId,
      });

      return { message: "Sector revoked successfully" };
    },
  )
  .get(
    "/users/:id/assignments",
    async ({ params, getUser }: any) => {
      const actor = await getUser();
      return accessUseCases.getUserAssignments().execute({
        targetUserId: params.id,
        actorRole: actor.role.name,
      });
    },
    {
      detail: {
        summary: "Get assignments for a user (admin)",
        description:
          "Returns invite-shaped per-sector manager + territory assignments with map boundaries.",
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
        targetUserId: params.id,
        actorUserId: assignedBy,
        actorRole: actor.role.name as Role,
        sectorAssignments: parsed.sectorAssignments.map((s) => ({
          sectorId: s.sectorId,
          managerId: s.managerId,
          territoryIds: s.territoryIds,
        })),
      });
    },
    {
      detail: {
        summary: "Replace user sector/territory assignments",
        tags: ["Users"],
        security: [{ bearerAuth: [] }],
      },
      body: t.Object({
        sectorAssignments: t.Array(
          t.Object({
            sectorId: t.String(),
            managerId: t.Optional(t.String()),
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
        sectorId: query.sectorId,
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
        sectorId: t.String({ description: "Healthcare sector ID" }),
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
