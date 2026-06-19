import { Elysia, t } from "elysia";
import { accessUseCases, auth } from "../../composition";

export const capabilitiesRoute = new Elysia({
  detail: {
    tags: ["Authentication"],
  },
})
  .use(auth)
  .get(
    "/me/capabilities",
    async ({ getUserId }: any) => {
      const userId = await getUserId();
      const result = await accessUseCases.getCapabilities().execute({ userId });

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
    },
    {
      detail: {
        summary: "Get user capabilities",
        description:
          "Returns the authenticated user's role and active access grants.",
        tags: ["Authentication"],
      },
      response: {
        200: t.Object({
          role: t.String(),
          grants: t.Array(
            t.Object({
              id: t.String(),
              resource: t.String(),
              resourceId: t.Optional(t.String()),
              action: t.String(),
              conditions: t.Optional(t.Record(t.String(), t.Any())),
              expiresAt: t.Optional(t.String()),
            })
          ),
        }),
      },
    }
  );
