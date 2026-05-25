import { Elysia, t } from "elysia";
import { inviteUserSchema } from "@atlasmed/access";
import { PrismaUserRepository } from "../repositories/prisma/prisma-user.repository";
import { PrismaInviteRepository } from "../repositories/prisma/prisma-invite.repository";
import { InviteUserUseCase } from "../../application/use-cases/invite-user.use-case";
import { authMiddleware } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permission.middleware";
import { inviteRateLimitMiddleware } from "../middleware/rate-limit.middleware";
import { sendInviteEmail } from "../email/send-email";
import { sendInviteWhatsApp } from "../../../../infrastructure/external-services/twilio/send-whatsapp";

const userRepository = new PrismaUserRepository();
const inviteRepository = new PrismaInviteRepository();

const inviteUserUseCase = new InviteUserUseCase({
  userRepository,
  inviteRepository,
});

export const inviteUserRoute = new Elysia({ 
  prefix: "/access",
  detail: {
    tags: ["Users"],
  },
})
  .use(authMiddleware)
  .use(requirePermission("create", "USER"))
  .post("/invites", async ({ body, auth }: any) => {
    await inviteRateLimitMiddleware({ body, auth, request: { headers: new Map() }, set: { headers: {}, status: 200 } } as any);

    const parsed = inviteUserSchema.parse(body);

    const result = await inviteUserUseCase.execute({
      email: parsed.email || undefined,
      phoneNumber: parsed.phoneNumber || undefined,
      roleId: parsed.roleId,
      invitedByUserId: auth.user.id,
    });

    if (parsed.email) {
      await sendInviteEmail(parsed.email, result.token, {
        invitedByName: auth.user.firstName
          ? `${auth.user.firstName} ${auth.user.lastName || ""}`.trim()
          : auth.user.username,
        roleName: result.invite.role?.name,
      });
    } else if (parsed.phoneNumber) {
      await sendInviteWhatsApp(parsed.phoneNumber, result.token, {
        invitedByName: auth.user.firstName
          ? `${auth.user.firstName} ${auth.user.lastName || ""}`.trim()
          : auth.user.username,
        roleName: result.invite.role?.name,
      });
    }

    return {
      invite: result.invite,
      token: result.token,
    };
  }, {
    detail: {
      summary: "Invite a new user",
      description: "Create an invitation for a new user. Requires admin permissions. Either email or phone number must be provided.",
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
        token: t.String({ description: "Invite token to be sent to the user" }),
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
