import { Elysia, t } from "elysia";
import { z } from "zod";
import { auth } from "../../../access/composition";
import { requirePermission } from "../../../access/infrastructure/middleware/permission.middleware";
import { ValidationError } from "../../../../shared/errors";
import { interactionUseCases } from "../../composition";

const recordInteractionSchema = z.object({
  facilityId: z.string().min(1),
  type: z.enum(["followup", "presentation"]),
  summary: z.string().min(1),
  interactedAt: z.string().datetime({ offset: true }).optional(),
});

function parseRecordInteractionBody(body: unknown) {
  const parsed = recordInteractionSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues.map((issue) => ({ field: issue.path.join(".") || "body", message: issue.message }))
    );
  }
  return {
    facilityId: parsed.data.facilityId,
    type: parsed.data.type,
    summary: parsed.data.summary,
    interactedAt: parsed.data.interactedAt ? new Date(parsed.data.interactedAt) : undefined,
  };
}

const recordInteractionRoute = new Elysia()
  .use(auth)
  .use(requirePermission("create", "INTERACTION"))
  .post(
    "/interactions",
    async ({ body, getScope, getUserId }) => {
      const [scope, userId] = await Promise.all([getScope(), getUserId()]);
      return interactionUseCases.recordInteraction().execute({ userId, scope, ...parseRecordInteractionBody(body) });
    },
    {
      detail: { summary: "Record clinic interaction", tags: ["Interactions"], security: [{ bearerAuth: [] }] },
      body: t.Object({
        facilityId: t.String({ minLength: 1 }),
        type: t.Union([t.Literal("followup"), t.Literal("presentation")]),
        summary: t.String({ minLength: 1 }),
        interactedAt: t.Optional(t.String()),
      }),
    }
  );

const weeklySummaryRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "INTERACTION"))
  .get(
    "/interactions/weekly-summary",
    async ({ getScope, getUserId }) => {
      const [scope, userId] = await Promise.all([getScope(), getUserId()]);
      return interactionUseCases.getWeeklySummary().execute({ userId, scope });
    },
    { detail: { summary: "Get current weekly interaction summary", tags: ["Interactions"], security: [{ bearerAuth: [] }] } }
  );

export const interactionsRoute = new Elysia().use(recordInteractionRoute).use(weeklySummaryRoute);
