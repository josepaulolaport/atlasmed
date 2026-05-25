import { Elysia } from "elysia";
import { PrismaInviteRepository } from "../repositories/prisma/prisma-invite.repository";
import { RevokeInviteUseCase } from "../../application/use-cases/revoke-invite.use-case";
import { authMiddleware } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permission.middleware";

const inviteRepository = new PrismaInviteRepository();

const revokeInviteUseCase = new RevokeInviteUseCase({
  inviteRepository,
});

export const revokeInviteRoute = new Elysia({ prefix: "/access" })
  .use(authMiddleware)
  .use(requirePermission("manage", "USER"))
  .delete("/invites/:id", async ({ params }) => {
    await revokeInviteUseCase.execute({
      inviteId: params.id,
    });

    return {
      message: "Invite revoked successfully",
    };
  });
