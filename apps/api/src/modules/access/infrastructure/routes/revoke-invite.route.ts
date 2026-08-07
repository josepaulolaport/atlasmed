import { Elysia, t } from "elysia";
import { Role } from "@atlasmed/access";
import { accessUseCases, auth } from "../../composition";
import { requirePermission } from "../middleware/permission.middleware";

export const revokeInviteRoute = new Elysia()
  .use(auth)
  .use(requirePermission("delete", "INVITATION"))
  .delete(
    "/invites/:id",
    async ({ params, getUserId, getUser }) => {
      const revokedByUserId = await getUserId();
      const user = await getUser();

      await accessUseCases.revokeInvite().execute({
        inviteId: params.id,
        revokedByUserId,
        actorRole: user.role.name as Role,
      });

      return {
        message: "Invite revoked successfully",
      };
    },
    {
      params: t.Object({ id: t.Number({ minimum: 1 }) }),
    },
  );
