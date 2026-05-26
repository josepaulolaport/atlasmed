import { Elysia } from "elysia";
import { accessUseCases, auth } from "../../composition";
import { requirePermission } from "../middleware/permission.middleware";

export const revokeInviteRoute = new Elysia()
  .use(auth)
  .use(requirePermission("delete", "INVITATION"))
  .delete("/invites/:id", async ({ params, getUserId }: any) => {
    const revokedByUserId = await getUserId();

    await accessUseCases.revokeInvite().execute({
      inviteId: params.id,
      revokedByUserId,
    });

    return {
      message: "Invite revoked successfully",
    };
  });
