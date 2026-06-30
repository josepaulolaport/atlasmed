import { Elysia, t } from "elysia";
import { grantPermissionSchema, revokePermissionSchema } from "@atlasmed/access";
import { accessUseCases, auth } from "../../composition";
import { requirePermission } from "../middleware/permission.middleware";

export const userPermissionsRoute = new Elysia({
  detail: { tags: ["Users"] },
})
  .use(auth)
  .use(requirePermission("manage", "USER"))
  .get("/users/:id/capabilities", async ({ params }: any) => {
    const result = await accessUseCases.getCapabilities().execute({
      userId: params.id,
    });

    return {
      role: result.role,
      grants: result.grants.map((grant) => ({
        id: grant.id,
        resource: grant.resource,
        resourceId: grant.resourceId ?? undefined,
        action: grant.action,
        conditions: grant.conditions,
        expiresAt: grant.expiresAt?.toISOString(),
      })),
    };
  })
  .post("/users/:id/permissions", async ({ params, body, getUserId, getUser }: any) => {
    const actor = await getUser();
    const parsed = grantPermissionSchema.parse(body);

    const grant = await accessUseCases.grantPermission().execute({
      targetUserId: params.id,
      resource: parsed.resource,
      resourceId: parsed.resourceId,
      action: parsed.action,
      conditions: parsed.conditions,
      grantedBy: await getUserId(),
      actorRole: actor.role.name,
      expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt) : undefined,
    });

    return {
      grant: {
        id: grant.id,
        resource: grant.resource,
        resourceId: grant.resourceId ?? undefined,
        action: grant.action,
        conditions: grant.conditions,
        expiresAt: grant.expiresAt?.toISOString(),
      },
      message: "Permission granted",
    };
  }, {
    body: t.Object({
      resource: t.String(),
      resourceId: t.Optional(t.String()),
      action: t.String(),
      conditions: t.Optional(t.Record(t.String(), t.Any())),
      expiresAt: t.Optional(t.String()),
    }),
  })
  .delete("/users/:id/permissions", async ({ params, body, getUserId, getUser }: any) => {
    const actor = await getUser();
    const parsed = revokePermissionSchema.parse(body);

    await accessUseCases.revokePermission().execute({
      targetUserId: params.id,
      resource: parsed.resource,
      resourceId: parsed.resourceId,
      action: parsed.action,
      revokedBy: await getUserId(),
      actorRole: actor.role.name,
    });

    return { message: "Permission revoked" };
  }, {
    body: t.Object({
      resource: t.String(),
      resourceId: t.Optional(t.String()),
      action: t.String(),
    }),
  });
