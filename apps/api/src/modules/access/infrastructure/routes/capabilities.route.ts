import { Elysia, t } from "elysia";
import { accessUseCases, auth } from "../../composition";

export const capabilitiesRoute = new Elysia({
  detail: {
    tags: ["Authentication"],
  },
})
  .use(auth)
  .get(
    "/user/capabilities",
    async ({ getUserId }: any) => {
      const userId = await getUserId();
      const result = await accessUseCases.getCapabilities().execute({ userId });

      return result;
    },
    {
      detail: {
        summary: "Get user capabilities",
        description:
          "Returns the authenticated user's capability snapshot.",
        tags: ["Authentication"],
      },
      response: {
        200: t.Object({
          version: t.Literal(1),
          capabilities: t.Array(t.String()),
        }),
      },
    }
  );

capabilitiesRoute.get(
  "/me/capabilities",
  async ({ getUserId }: any) => {
    const userId = await getUserId();
    return accessUseCases.getCapabilities().execute({ userId });
  },
  {
    detail: {
      summary: "Get current user capabilities",
      description: "Alias for the authenticated user's capability snapshot.",
      tags: ["Authentication"],
    },
    response: {
      200: t.Object({
        version: t.Literal(1),
        capabilities: t.Array(t.String()),
      }),
    },
  }
);
