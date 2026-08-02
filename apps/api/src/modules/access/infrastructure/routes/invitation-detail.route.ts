import { Elysia, t } from "elysia";
import { Role, updateInvitationSchema } from "@atlasmed/access";
import { accessUseCases, auth } from "../../composition";
import { requirePermission } from "../middleware/permission.middleware";

export const invitationDetailRoute = new Elysia({
  detail: {
    tags: ["Users"],
  },
})
  .use(auth)
  .use(requirePermission("read", "USER"))
  .get(
    "/invitations/:id",
    async ({ params, getUser }: any) => {
      const actor = await getUser();
      return accessUseCases.getInvitationById().execute({
        inviteId: params.id,
        actorRole: actor.role.name as Role,
      });
    },
    {
      detail: {
        summary: "Get invitation by id",
        tags: ["Users"],
        security: [{ bearerAuth: [] }],
      },
    },
  )
  .use(requirePermission("update", "INVITATION"))
  .patch(
    "/invites/:id",
    async ({ params, body, getUser }: any) => {
      const actor = await getUser();
      const parsed = updateInvitationSchema.parse(body);

      return accessUseCases.updateInvitation().execute({
        inviteId: params.id,
        actorUserId: actor.id,
        actorRole: actor.role.name as Role,
        email: parsed.email,
        phoneNumber: parsed.phoneNumber,
        roleId: parsed.roleId,
        firstName: parsed.firstName,
        lastName: parsed.lastName,
        birthDate: parsed.birthDate,
        verticalAssignments: parsed.verticalAssignments,
      });
    },
    {
      detail: {
        summary: "Update a pending invitation",
        tags: ["Users"],
        security: [{ bearerAuth: [] }],
      },
      body: t.Object({
        email: t.Optional(t.String({ format: "email" })),
        phoneNumber: t.Optional(t.Union([t.String(), t.Null()])),
        roleId: t.Optional(t.String()),
        firstName: t.Optional(t.String({ minLength: 1 })),
        lastName: t.Optional(t.String({ minLength: 1 })),
        birthDate: t.Optional(
          t.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" }),
        ),
        verticalAssignments: t.Optional(
          t.Array(
            t.Object({
              verticalId: t.String(),
              territoryIds: t.Optional(t.Array(t.String())),
              newPatch: t.Optional(
                t.Object({
                  name: t.String({ minLength: 1 }),
                  managerZoneId: t.String(),
                  slug: t.Optional(t.String()),
                  boundary: t.Object({
                    type: t.Union([
                      t.Literal("Polygon"),
                      t.Literal("MultiPolygon"),
                    ]),
                    coordinates: t.Unknown(),
                  }),
                }),
              ),
            }),
          ),
        ),
      }),
    },
  );
