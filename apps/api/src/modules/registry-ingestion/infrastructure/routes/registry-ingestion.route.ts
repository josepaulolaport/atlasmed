import { Elysia, t } from "elysia";
import { auth } from "../../../access/composition";
import { requirePermission } from "../../../access/infrastructure/middleware/permission.middleware";
import { registryIngestionUseCases } from "../../composition";
import { ResourceNotFoundError } from "../../../../shared/errors";

const runIngestionRoute = new Elysia()
  .use(auth)
  .use(requirePermission("manage", "REGISTRY_INGESTION"))
  .post(
    "/registry-ingestion/run",
    async ({ getUserId }) => {
      const userId = await getUserId();
      return registryIngestionUseCases.runIngestion().execute({
        actorUserId: userId,
      });
    },
    {
      detail: {
        summary: "Run registry ingestion",
        tags: ["Registry Ingestion"],
        security: [{ bearerAuth: [] }],
      },
    }
  );

const runDemoRoute = new Elysia()
  .use(auth)
  .use(requirePermission("manage", "REGISTRY_INGESTION"))
  .post(
    "/registry-ingestion/demo",
    async ({ getUserId }) => {
      const userId = await getUserId();
      return registryIngestionUseCases.runDemo().execute({
        actorUserId: userId,
      });
    },
    {
      detail: {
        summary: "Run mock registry demo scenario",
        description:
          "Resets mock registry data and replays v1 → v2 → v4 fixtures to generate sample suggestions",
        tags: ["Registry Ingestion"],
        security: [{ bearerAuth: [] }],
      },
    }
  );

const listRunsRoute = new Elysia()
  .use(auth)
  .use(requirePermission("manage", "REGISTRY_INGESTION"))
  .get(
    "/registry-ingestion/runs",
    async ({ query }) => {
      return registryIngestionUseCases.listRuns().execute({
        page: query.page ? Number(query.page) : undefined,
        limit: query.limit ? Number(query.limit) : undefined,
        sourceProvider: query.sourceProvider,
      });
    },
    {
      detail: {
        summary: "List registry ingestion runs",
        tags: ["Registry Ingestion"],
        security: [{ bearerAuth: [] }],
      },
      query: t.Object({
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        sourceProvider: t.Optional(t.String()),
      }),
    }
  );

const listSuggestionsRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "REGISTRY_SUGGESTION"))
  .get(
    "/registry-suggestions",
    async ({ query, getScope }) => {
      const scope = await getScope();
      return registryIngestionUseCases.listSuggestions().execute({
        scope,
        page: query.page ? Number(query.page) : undefined,
        limit: query.limit ? Number(query.limit) : undefined,
        status: query.status as
          | "PENDING"
          | "APPROVED"
          | "REJECTED"
          | "EXPIRED"
          | "SUPERSEDED"
          | undefined,
        type: query.type as
          | "CLINIC_REMOVAL"
          | "CLINIC_REACTIVATION"
          | "DOCTOR_CLINIC_REMOVAL"
          | undefined,
      });
    },
    {
      detail: {
        summary: "List registry suggestions",
        tags: ["Registry Ingestion"],
        security: [{ bearerAuth: [] }],
      },
      query: t.Object({
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        status: t.Optional(t.String()),
        type: t.Optional(t.String()),
      }),
    }
  );

const approveSuggestionRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "REGISTRY_SUGGESTION"))
  .post(
    "/registry-suggestions/:id/approve",
    async ({ params, body, getUserId, getScope }) => {
      const scope = await getScope();
      const userId = await getUserId();
      const result = await registryIngestionUseCases.approveSuggestion().execute({
        suggestionId: params.id,
        userId,
        scope,
        resolutionNote: body.resolutionNote,
      });

      if (!result) {
        throw new ResourceNotFoundError("Suggestion", params.id);
      }

      return result;
    },
    {
      detail: {
        summary: "Approve registry suggestion",
        tags: ["Registry Ingestion"],
        security: [{ bearerAuth: [] }],
      },
      body: t.Object({
        resolutionNote: t.Optional(t.String()),
      }),
    }
  );

const rejectSuggestionRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "REGISTRY_SUGGESTION"))
  .post(
    "/registry-suggestions/:id/reject",
    async ({ params, body, getUserId, getScope }) => {
      const scope = await getScope();
      const userId = await getUserId();
      const result = await registryIngestionUseCases.rejectSuggestion().execute({
        suggestionId: params.id,
        userId,
        scope,
        resolutionNote: body.resolutionNote,
      });

      if (!result) {
        throw new ResourceNotFoundError("Suggestion", params.id);
      }

      return result;
    },
    {
      detail: {
        summary: "Reject registry suggestion",
        tags: ["Registry Ingestion"],
        security: [{ bearerAuth: [] }],
      },
      body: t.Object({
        resolutionNote: t.Optional(t.String()),
      }),
    }
  );

export const registryIngestionRoutes = new Elysia()
  .use(runIngestionRoute)
  .use(runDemoRoute)
  .use(listRunsRoute)
  .use(listSuggestionsRoute)
  .use(approveSuggestionRoute)
  .use(rejectSuggestionRoute);
