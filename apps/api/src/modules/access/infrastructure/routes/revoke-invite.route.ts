import { Elysia } from "elysia";
import { accessUseCases, auth } from "../../composition";
import { requirePermission } from "../middleware/permission.middleware";

export const revokeInviteRoute = new Elysia()
  .use(auth)
  .use(requirePermission("delete", "INVITATION"))
  .delete("/invites/:id", async ({ params, getUserId, getUser }: any) => {
    const revokedByUserId = await getUserId();
    const user = await getUser();

    await accessUseCases.revokeInvite().execute({
      inviteId: params.id,
      revokedByUserId,
      actorRole: user.role.name,
    });

    return {
      message: "Invite revoked successfully",
    };
  });
