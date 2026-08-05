import { Elysia, t } from "elysia";
import {
  APP_CAPABILITY_ACTIONS,
  toLegacyAppCapabilities,
  type AppCapability,
} from "@atlasmed/access";
import { accessUseCases, auth } from "../../composition";

const capabilityResponseSchema = t.Unsafe<AppCapability[]>({
  type: "array",
  items: {
    oneOf: Object.entries(APP_CAPABILITY_ACTIONS).map(([resource, actions]) => ({
      type: "object",
      additionalProperties: false,
      required: ["resource", "actions"],
      properties: {
        resource: { type: "string", const: resource },
        actions: { type: "array", items: { type: "string", enum: actions } },
      },
    })),
  },
});

function legacyCapabilitySnapshot(capabilities: AppCapability[]) {
  return { version: 1 as const, capabilities: toLegacyAppCapabilities(capabilities) };
}

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

      return legacyCapabilitySnapshot(result.capabilities);
    },
    {
      detail: {
        summary: "Get user capabilities",
        description:
          "Returns the authenticated user's version 1 capability snapshot.",
        tags: ["Authentication"],
      },
      response: {
        200: t.Object({
          version: t.Literal(1),
          capabilities: t.Array(t.String()),
        }),
      },
    }
  )
  .get(
    "/user/capabilities/v2",
    async ({ getUserId }: any) => {
      const userId = await getUserId();
      return accessUseCases.getCapabilities().execute({ userId });
    },
    {
      detail: {
        summary: "Get user capabilities (v2)",
        description:
          "Returns the authenticated user's typed capability snapshot grouped by resource.",
        tags: ["Authentication"],
      },
      response: {
        200: t.Object({
          version: t.Literal(2),
          capabilities: capabilityResponseSchema,
        }),
      },
    }
  );

capabilitiesRoute.get(
  "/me/capabilities",
  async ({ getUserId }: any) => {
    const userId = await getUserId();
    const result = await accessUseCases.getCapabilities().execute({ userId });
    return legacyCapabilitySnapshot(result.capabilities);
  },
  {
    detail: {
      summary: "Get current user capabilities",
      description: "Alias for the authenticated user's version 1 capability snapshot.",
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
