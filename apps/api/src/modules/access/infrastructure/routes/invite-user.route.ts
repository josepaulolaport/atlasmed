import { Elysia, t } from "elysia";
import { inviteUserSchema } from "@atlasmed/access";
import { accessUseCases, auth } from "../../composition";
import { requirePermission } from "../middleware/permission.middleware";
import { inviteRateLimit } from "../middleware/rate-limit.middleware";
import { sendInviteEmail } from "../email/send-email";
import { sendInviteWhatsApp } from "../../../../infrastructure/external-services/twilio/send-whatsapp";
import { environment } from "../../../../app/config/environment";

export const inviteUserRoute = new Elysia({ 
  detail: {
    tags: ["Users"],
  },
})
  .use(auth)
  .use(requirePermission("create", "INVITATION"))
  .use(inviteRateLimit)
  .post("/invite", async ({ body, getUser, request, status }: any) => {
    const user = await getUser();

    const parsed = inviteUserSchema.parse(body);

    try {
      const result = await accessUseCases.inviteUser().execute({
        email: parsed.email || undefined,
        phoneNumber: parsed.phoneNumber || undefined,
        roleId: parsed.roleId,
        invitedByUserId: user.id,
      });

      if (parsed.email) {
        await sendInviteEmail(parsed.email, result.token, {
          invitedByName: user.firstName
            ? `${user.firstName} ${user.lastName || ""}`.trim()
            : user.username,
          roleName: result.invite.role?.name,
          inviteUrl: `${environment.FRONTEND_URL}/register`,
        });
      } else if (parsed.phoneNumber) {
        await sendInviteWhatsApp(parsed.phoneNumber, result.token, {
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
        },
        message: "Invitation sent successfully",
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("Invalid roleId")) {
          return status(400, {
            code: "INVALID_ROLE",
            error: error.message,
          });
        }
        if (error.message.includes("already exists")) {
          return status(409, {
            code: "CONFLICT",
            error: error.message,
          });
        }
      }
      throw error;
    }
  }, {
    detail: {
      summary: "Invite a new user",
      description: "Create an invitation for a new user and deliver the invite token via email or WhatsApp. Requires admin permissions. Either email or phone number must be provided.",
      tags: ["Users"],
      security: [{ bearerAuth: [] }],
    },
    body: t.Object({
      email: t.Optional(t.String({ format: "email", description: "User email address" })),
      phoneNumber: t.Optional(t.String({ description: "User phone number" })),
      roleId: t.String({ description: "Role ID to assign to the invited user" }),
    }),
    response: {
      200: t.Object({
        invite: t.Object({
          id: t.String(),
          email: t.Optional(t.String()),
          phoneNumber: t.Optional(t.String()),
          status: t.String(),
          expiresAt: t.String(),
        }),
        message: t.String({ description: "Confirmation that the invitation was sent" }),
      }),
      400: t.Object({
        error: t.String({ description: "Validation error or user already exists" }),
      }),
      401: t.Object({
        error: t.String({ description: "Unauthorized" }),
      }),
      403: t.Object({
        error: t.String({ description: "Forbidden - insufficient permissions" }),
      }),
      429: t.Object({
        error: t.String({ description: "Too many requests" }),
        retryAfter: t.String(),
      }),
    },
  });
