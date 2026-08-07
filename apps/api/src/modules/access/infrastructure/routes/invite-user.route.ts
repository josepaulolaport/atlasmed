import { Elysia, t } from "elysia";
import { ZodError } from "zod";
import { Role } from "@atlasmed/access";
import { inviteUserSchema } from "@atlasmed/access";
import { accessUseCases, auth } from "../../composition";
import { requirePermission } from "../middleware/permission.middleware";
import { inviteRateLimit } from "../middleware/rate-limit.middleware";
import { sendInviteEmail } from "../email/send-email";
import { resolveInviteAcceptUrl } from "../email/invite-accept-url";
import { sendInviteWhatsApp } from "../../../../infrastructure/external-services/twilio/send-whatsapp";
import { ValidationError } from "../../../../shared/errors";

export const inviteUserRoute = new Elysia({ 
  detail: {
    tags: ["Users"],
  },
})
  .use(auth)
  .use(requirePermission("create", "INVITATION"))
  .use(inviteRateLimit)
  .post("/invite", async ({ body, getUser, request, status }) => {
    const user = await getUser();

    let parsed: ReturnType<typeof inviteUserSchema.parse>;
    try {
      parsed = inviteUserSchema.parse(body);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new ValidationError(
          error.issues.map((issue) => ({
            field: issue.path.join(".") || "body",
            message: issue.message,
          })),
        );
      }
      throw error;
    }

    try {
      const result = await accessUseCases.inviteUser().execute({
        email: parsed.email || undefined,
        phoneNumber: parsed.phoneNumber || undefined,
        roleId: parsed.roleId,
        invitedByUserId: user.id,
        firstName: parsed.firstName,
        lastName: parsed.lastName,
        birthDate: parsed.birthDate,
        verticalAssignments: parsed.verticalAssignments,
      });

      if (parsed.email) {
        try {
          await sendInviteEmail(parsed.email, result.token, {
            invitedByName: user.firstName
              ? `${user.firstName} ${user.lastName || ""}`.trim()
              : user.username,
            roleName: result.invite.role?.name,
            inviteUrl: resolveInviteAcceptUrl(),
          });
        } catch {
          await accessUseCases.revokeInvite().execute({
            inviteId: result.invite.id,
            revokedByUserId: user.id,
            actorRole: user.role.name as Role,
          });
          return status(502, {
            code: "DELIVERY_FAILED",
            error: "Invitation created but delivery failed; invite was revoked",
          });
        }
      } else if (parsed.phoneNumber) {
        try {
          await sendInviteWhatsApp(parsed.phoneNumber, result.token, {
            invitedByName: user.firstName
              ? `${user.firstName} ${user.lastName || ""}`.trim()
              : user.username,
            roleName: result.invite.role?.name,
          });
        } catch {
          await accessUseCases.revokeInvite().execute({
            inviteId: result.invite.id,
            revokedByUserId: user.id,
            actorRole: user.role.name as Role,
          });
          return status(502, {
            code: "DELIVERY_FAILED",
            error: "Invitation created but delivery failed; invite was revoked",
          });
        }
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
      roleId: t.Number({
        minimum: 1,
        description: "Role ID to assign to the invited user",
      }),
      firstName: t.String({ minLength: 1, description: "First name of the invited user" }),
      lastName: t.String({ minLength: 1, description: "Last name of the invited user" }),
      birthDate: t.String({
        pattern: "^\\d{4}-\\d{2}-\\d{2}$",
        description: "Invitee birth date (YYYY-MM-DD) — confirmed at registration",
      }),
      verticalAssignments: t.Optional(t.Array(t.Object({
        verticalId: t.Number({ minimum: 1 }),
        territoryIds: t.Optional(t.Array(t.Number({ minimum: 1 }))),
        newPatch: t.Optional(t.Object({
          name: t.String({ minLength: 1 }),
          managerZoneId: t.Number({ minimum: 1 }),
          slug: t.Optional(t.String()),
          boundary: t.Object({
            type: t.Union([t.Literal("Polygon"), t.Literal("MultiPolygon")]),
            coordinates: t.Unknown(),
          }),
        })),
      }))),
    }),
    response: {
      200: t.Object({
        invite: t.Object({
          id: t.Number({ minimum: 1 }),
          email: t.Optional(t.String()),
          phoneNumber: t.Optional(t.String()),
          status: t.String(),
          expiresAt: t.String(),
        }),
        message: t.String({ description: "Confirmation that the invitation was sent" }),
      }),
      400: t.Object({
        code: t.Optional(t.String()),
        error: t.String({ description: "Validation error or user already exists" }),
      }),
      409: t.Object({
        code: t.String(),
        error: t.String({ description: "User already exists" }),
      }),
      502: t.Object({
        code: t.String(),
        error: t.String({ description: "Invitation delivery failed" }),
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
