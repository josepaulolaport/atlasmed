import { Elysia, t } from "elysia";
import { z } from "zod";
import { auth } from "../../../access/composition";
import { requirePermission } from "../../../access/infrastructure/middleware/permission.middleware";
import { ResourceNotFoundError, ValidationError } from "../../../../shared/errors";
import { fieldSuggestionUseCases } from "../../composition";

function parseSchema<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(
      result.error.issues.map((issue) => ({
        field: issue.path.join(".") || "body",
        message: issue.message,
      }))
    );
  }
  return result.data;
}

const createBodySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("FIELD_CHANGE"),
    fieldKey: z.string().min(1),
    proposedValue: z.unknown(),
    reason: z.string().trim().min(1).optional().nullable(),
  }),
  z.object({
    kind: z.literal("DEACTIVATION"),
    reason: z.string().trim().min(1).optional().nullable(),
  }),
]);

const createFacilityFieldSuggestionRoute = new Elysia()
  .use(auth)
  .use(requirePermission("create", "FIELD_SUGGESTION"))
  .post(
    "/facilities/:id/field-suggestions",
    async ({ params, body, getUserId, getScope, set }) => {
      const parsed = parseSchema(createBodySchema, body);
      const scope = await getScope();
      const userId = await getUserId();

      const result = await fieldSuggestionUseCases
        .createFacilityFieldSuggestion()
        .execute({
          facilityId: params.id,
          userId,
          scope,
          kind: parsed.kind,
          fieldKey: parsed.kind === "FIELD_CHANGE" ? parsed.fieldKey : undefined,
          proposedValue:
            parsed.kind === "FIELD_CHANGE" ? parsed.proposedValue : undefined,
          reason: parsed.reason,
        });

      if (!result) {
        throw new ResourceNotFoundError("Facility", params.id);
      }

      set.status = 201;
      return result;
    },
    {
      detail: {
        summary: "Create facility field suggestion (Não Conformidade)",
        tags: ["FieldSuggestions"],
        security: [{ bearerAuth: [] }],
      },
      params: t.Object({ id: t.Number({ minimum: 1 }) }),
      body: t.Object({
        kind: t.Union([t.Literal("FIELD_CHANGE"), t.Literal("DEACTIVATION")]),
        fieldKey: t.Optional(t.String()),
        proposedValue: t.Optional(t.Unknown()),
        reason: t.Optional(t.Nullable(t.String())),
      }),
    }
  );

const listFacilityFieldSuggestionsRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "FACILITY", { resourceIdParam: "id" }))
  .get(
    "/facilities/:id/field-suggestions",
    async ({ params, query, getUserId, getScope }) => {
      const scope = await getScope();
      const userId = await getUserId();
      const mine = query.mine === "true" || query.mine === "1";

      return fieldSuggestionUseCases.listFieldSuggestions().execute({
        scope,
        userId,
        facilityId: params.id,
        page: query.page,
        limit: query.limit,
        status: query.status as
          | "PENDING"
          | "APPROVED"
          | "REJECTED"
          | undefined,
        mineOnly: mine,
        submittedByUserId: mine ? userId : undefined,
      });
    },
    {
      detail: {
        summary: "List field suggestions for a facility",
        tags: ["FieldSuggestions"],
        security: [{ bearerAuth: [] }],
      },
      params: t.Object({ id: t.Number({ minimum: 1 }) }),
      query: t.Object({
        mine: t.Optional(t.String()),
        page: t.Optional(t.Number({ minimum: 1 })),
        limit: t.Optional(t.Number({ minimum: 1 })),
        status: t.Optional(t.String()),
      }),
    }
  );

const listFieldSuggestionsRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "FIELD_SUGGESTION"))
  .get(
    "/field-suggestions",
    async ({ query, getUserId, getScope }) => {
      const scope = await getScope();
      const userId = await getUserId();
      const statusParam = query.status?.toUpperCase();
      const status =
        statusParam === "ALL" || statusParam === ""
          ? undefined
          : ((statusParam as "PENDING" | "APPROVED" | "REJECTED" | undefined) ??
            "PENDING");

      return fieldSuggestionUseCases.listFieldSuggestions().execute({
        scope,
        userId,
        page: query.page,
        limit: query.limit,
        status,
        facilityId: query.facilityId,
      });
    },
    {
      detail: {
        summary: "List ops field suggestions queue",
        tags: ["FieldSuggestions"],
        security: [{ bearerAuth: [] }],
      },
      query: t.Object({
        page: t.Optional(t.Number({ minimum: 1 })),
        limit: t.Optional(t.Number({ minimum: 1 })),
        status: t.Optional(t.String()),
        facilityId: t.Optional(t.Number({ minimum: 1 })),
      }),
    }
  );

const getFieldSuggestionRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "FIELD_SUGGESTION"))
  .get(
    "/field-suggestions/:id",
    async ({ params, getScope }) => {
      const scope = await getScope();
      const result = await fieldSuggestionUseCases.getFieldSuggestion().execute({
        suggestionId: params.id,
        scope,
      });
      if (!result) {
        throw new ResourceNotFoundError("FieldSuggestion", params.id);
      }
      return result;
    },
    {
      detail: {
        summary: "Get field suggestion by id",
        tags: ["FieldSuggestions"],
        security: [{ bearerAuth: [] }],
      },
      params: t.Object({ id: t.Number({ minimum: 1 }) }),
    }
  );

const approveFieldSuggestionRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "FIELD_SUGGESTION"))
  .post(
    "/field-suggestions/:id/approve",
    async ({ params, body, getUserId, getScope }) => {
      const scope = await getScope();
      const userId = await getUserId();
      const result = await fieldSuggestionUseCases.approveFieldSuggestion().execute({
        suggestionId: params.id,
        userId,
        scope,
        resolutionNote: body.resolutionNote,
        acceptCoverageLoss: body.acceptCoverageLoss,
      });
      if (!result) {
        throw new ResourceNotFoundError("FieldSuggestion", params.id);
      }
      return result;
    },
    {
      detail: {
        summary:
          "Approve field suggestion (location changes that strand a rep need acceptCoverageLoss)",
        tags: ["FieldSuggestions"],
        security: [{ bearerAuth: [] }],
      },
      params: t.Object({ id: t.Number({ minimum: 1 }) }),
      body: t.Object({
        resolutionNote: t.Optional(t.String()),
        /**
         * Spec 0009 R5. Omit it and a move that would leave reps outside their
         * patch is refused with 409 and the list of affected assignments; the
         * suggestion stays PENDING.
         */
        acceptCoverageLoss: t.Optional(t.Boolean()),
      }),
    }
  );

const rejectFieldSuggestionRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "FIELD_SUGGESTION"))
  .post(
    "/field-suggestions/:id/reject",
    async ({ params, body, getUserId, getScope }) => {
      const scope = await getScope();
      const userId = await getUserId();
      const result = await fieldSuggestionUseCases.rejectFieldSuggestion().execute({
        suggestionId: params.id,
        userId,
        scope,
        resolutionNote: body.resolutionNote,
      });
      if (!result) {
        throw new ResourceNotFoundError("FieldSuggestion", params.id);
      }
      return result;
    },
    {
      detail: {
        summary: "Reject field suggestion",
        tags: ["FieldSuggestions"],
        security: [{ bearerAuth: [] }],
      },
      params: t.Object({ id: t.Number({ minimum: 1 }) }),
      body: t.Object({
        resolutionNote: t.Optional(t.String()),
      }),
    }
  );

export const fieldSuggestionsRoute = new Elysia()
  .use(createFacilityFieldSuggestionRoute)
  .use(listFacilityFieldSuggestionsRoute)
  .use(listFieldSuggestionsRoute)
  .use(getFieldSuggestionRoute)
  .use(approveFieldSuggestionRoute)
  .use(rejectFieldSuggestionRoute);
