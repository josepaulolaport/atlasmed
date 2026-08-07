import { Elysia, t } from "elysia";
import {
  Role,
  grantPermissionSchema,
  revokePermissionSchema,
} from "@atlasmed/access";
import { tryParseCrmId } from "../../../../shared/utils/parse-crm-id";
import { accessUseCases, auth } from "../../composition";
import { requirePermission } from "../middleware/permission.middleware";

const userIdParams = t.Object({
  id: t.Number({ minimum: 1 }),
});

export const userPermissionsRoute = new Elysia({
  detail: { tags: ["Users"] },
})
  .use(auth)
  .use(requirePermission("manage", "USER"))
  .get(
    "/users/:id/capabilities",
    async ({ params }) => {
      const result = await accessUseCases.getCapabilities().execute({
        userId: params.id,
      });

      return {
        role: result.role,
        grants: result.grants.map((grant) => ({
          id: grant.id,
          resource: grant.resource,
          resourceId: tryParseCrmId(grant.resourceId),
          action: grant.action,
          conditions: grant.conditions,
          grantedAt: grant.grantedAt?.toISOString() ?? new Date().toISOString(),
          expiresAt: grant.expiresAt?.toISOString(),
        })),
      };
    },
    { params: userIdParams },
  )
  .post(
    "/users/:id/permissions",
    async ({ params, body, getUserId, getUser }) => {
      const actor = await getUser();
      const parsed = grantPermissionSchema.parse(body);

      const grant = await accessUseCases.grantPermission().execute({
        targetUserId: params.id,
        resource: parsed.resource,
        resourceId: parsed.resourceId,
        action: parsed.action,
        conditions: parsed.conditions,
        grantedBy: await getUserId(),
        actorRole: actor.role.name as Role,
        expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt) : undefined,
      });

      return {
        grant: {
          id: grant.id,
          resource: grant.resource,
          resourceId: tryParseCrmId(grant.resourceId),
          action: grant.action,
          conditions: grant.conditions,
          grantedAt: grant.grantedAt?.toISOString() ?? new Date().toISOString(),
          expiresAt: grant.expiresAt?.toISOString(),
        },
        message: "Permission granted",
      };
    },
    {
      params: userIdParams,
      body: t.Object({
        resource: t.String(),
        resourceId: t.Optional(t.Number({ minimum: 1 })),
        action: t.String(),
        conditions: t.Optional(t.Record(t.String(), t.Any())),
        expiresAt: t.Optional(t.String()),
      }),
    },
  )
  .delete(
    "/users/:id/permissions",
    async ({ params, body, getUserId, getUser }) => {
      const actor = await getUser();
      const parsed = revokePermissionSchema.parse(body);

      await accessUseCases.revokePermission().execute({
        targetUserId: params.id,
        resource: parsed.resource,
        resourceId: parsed.resourceId,
        action: parsed.action,
        revokedBy: await getUserId(),
        actorRole: actor.role.name as Role,
      });

      return { message: "Permission revoked" };
    },
    {
      params: userIdParams,
      body: t.Object({
        resource: t.String(),
        resourceId: t.Optional(t.Number({ minimum: 1 })),
        action: t.String(),
      }),
    },
  );
