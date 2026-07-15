import { Elysia, t } from "elysia";
import {
  assignUserManagerSchema,
  assignUserTerritorySchema,
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
      });

      return { message: "Sector assigned successfully" };
    },
    {
      body: t.Object({
        sectorId: t.String({ description: "Sector ID to assign to the user" }),
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
  );
