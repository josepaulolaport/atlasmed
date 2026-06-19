import { Elysia } from "elysia";
import { accessUseCases, auth } from "../../composition";
import { requirePermission } from "../middleware/permission.middleware";
import { inviteResendRateLimit } from "../middleware/rate-limit.middleware";
import { sendInviteEmail } from "../email/send-email";
import { sendInviteWhatsApp } from "../../../../infrastructure/external-services/twilio/send-whatsapp";
import { environment } from "../../../../app/config/environment";

export const resendInviteRoute = new Elysia({
  detail: {
    tags: ["Users"],
  },
})
  .use(auth)
  .use(requirePermission("update", "INVITATION"))
  .use(inviteResendRateLimit)
  .post("/invites/:id/resend", async ({ params, getUser, getScope }: any) => {
    const user = await getUser();
    const scope = await getScope();

    const result = await accessUseCases.resendInvite().execute({
      inviteId: params.id,
      actorId: user.id,
      actorRole: user.role.name,
      scope,
    });

    if (result.invite.email) {
      await sendInviteEmail(result.invite.email, result.token, {
        invitedByName: user.firstName
          ? `${user.firstName} ${user.lastName || ""}`.trim()
          : user.username,
        roleName: result.invite.role?.name,
        inviteUrl: `${environment.FRONTEND_URL}/register`,
      });
    } else if (result.invite.phoneNumber) {
      await sendInviteWhatsApp(result.invite.phoneNumber, result.token, {
        invitedByName: user.firstName
          ? `${user.firstName} ${user.lastName || ""}`.trim()
          : user.username,
        roleName: result.invite.role?.name,
      });
    }

    return {
      invite: {
        id: result.invite.id,
        email: result.invite.email ?? undefined,
        phoneNumber: result.invite.phoneNumber ?? undefined,
        status: result.invite.status,
        expiresAt: result.invite.expiresAt.toISOString(),
        resendCount: result.invite.resendCount,
        lastResendAt: result.invite.lastResendAt?.toISOString() ?? undefined,
      },
      message: "Invitation resent successfully",
    };
  });
