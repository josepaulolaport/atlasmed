import { Elysia, t } from "elysia";
import { auth } from "../../../access/composition";
import { requirePermission } from "../../../access/infrastructure/middleware/permission.middleware";
import { potentialUseCases } from "../../composition";

const listFacilityPotentialsRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "FACILITY", { resourceIdParam: "id" }))
  .get(
    "/facilities/:id/potentials",
    async ({ params, query, getScope }) => {
      const scope = await getScope();
      return potentialUseCases.listFacilityPotentials().execute({
        facilityId: params.id,
        verticalId: query.verticalId,
        scope,
      });
    },
    {
      detail: {
        summary: "List facility potential & share metrics for a Linha",
        tags: ["Potential"],
        security: [{ bearerAuth: [] }],
      },
      params: t.Object({ id: t.Number({ minimum: 1 }) }),
      query: t.Object({
        verticalId: t.Number({ minimum: 1 }),
      }),
    },
  );

const patchFacilityPotentialsRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "FACILITY", { resourceIdParam: "id" }))
  .patch(
    "/facilities/:id/potentials",
    async ({ params, body, getScope, getUserId }) => {
      const [scope, userId] = await Promise.all([getScope(), getUserId()]);
      return potentialUseCases.patchFacilityPotentials().execute({
        facilityId: params.id,
        verticalId: body.verticalId,
        userId,
        scope,
        values: body.values,
      });
    },
    {
      detail: {
        summary: "Update facility potential quantities for a Linha",
        tags: ["Potential"],
        security: [{ bearerAuth: [] }],
      },
      params: t.Object({ id: t.Number({ minimum: 1 }) }),
      body: t.Object({
        verticalId: t.Number({ minimum: 1 }),
        values: t.Array(
          t.Object({
            definitionId: t.Number({ minimum: 1 }),
            quantity: t.Union([t.Number(), t.Null()]),
          }),
        ),
      }),
    },
  );

const listDefinitionsRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "CATALOG"))
  .get(
    "/potential-definitions",
    async ({ query, getScope }) => {
      const scope = await getScope();
      return potentialUseCases.listDefinitions().execute({
        verticalId: query.verticalId,
        scope,
      });
    },
    {
      detail: {
        summary: "List potential metric definitions for a Linha",
        tags: ["Potential"],
        security: [{ bearerAuth: [] }],
      },
      query: t.Object({
        verticalId: t.Number({ minimum: 1 }),
      }),
    },
  );

const createDefinitionRoute = new Elysia()
  .use(auth)
  .use(requirePermission("create", "CATALOG"))
  .post(
    "/potential-definitions",
    async ({ body, getScope }) => {
      const scope = await getScope();
      return potentialUseCases.createDefinition().execute({
        ...body,
        verticalId: body.verticalId,
        scope,
      });
    },
    {
      detail: {
        summary: "Create potential metric definition",
        tags: ["Potential"],
        security: [{ bearerAuth: [] }],
      },
      body: t.Object({
        verticalId: t.Number({ minimum: 1 }),
        key: t.Optional(t.String()),
        label: t.String({ minLength: 1 }),
      }),
    },
  );

const updateDefinitionRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "CATALOG"))
  .patch(
    "/potential-definitions/:id",
    async ({ params, body, getScope }) => {
      const scope = await getScope();
      return potentialUseCases.updateDefinition().execute({
        id: params.id,
        ...body,
        scope,
      });
    },
    {
      detail: {
        summary: "Update potential metric definition",
        tags: ["Potential"],
        security: [{ bearerAuth: [] }],
      },
      params: t.Object({ id: t.Number({ minimum: 1 }) }),
      body: t.Object({
        label: t.Optional(t.String({ minLength: 1 })),
      }),
    },
  );

const deleteDefinitionRoute = new Elysia()
  .use(auth)
  .use(requirePermission("delete", "CATALOG"))
  .delete(
    "/potential-definitions/:id",
    async ({ params, getScope }) => {
      const scope = await getScope();
      return potentialUseCases.softDeleteDefinition().execute({
        id: params.id,
        scope,
      });
    },
    {
      detail: {
        summary: "Soft-delete potential metric definition",
        tags: ["Potential"],
        security: [{ bearerAuth: [] }],
      },
      params: t.Object({ id: t.Number({ minimum: 1 }) }),
    },
  );

const listDefinitionProductsRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "CATALOG"))
  .get(
    "/potential-definitions/:id/products",
    async ({ params, getScope }) => {
      const scope = await getScope();
      return potentialUseCases.listDefinitionProducts().execute({
        definitionId: params.id,
        scope,
      });
    },
    {
      detail: {
        summary: "List products linked to a potential definition",
        tags: ["Potential"],
        security: [{ bearerAuth: [] }],
      },
      params: t.Object({ id: t.Number({ minimum: 1 }) }),
    },
  );

const linkProductRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "CATALOG"))
  .put(
    "/products/:id/potential-definition",
    async ({ params, body, getScope }) => {
      const scope = await getScope();
      return potentialUseCases.linkProduct().execute({
        productId: params.id,
        definitionId: body.definitionId,
        scope,
      });
    },
    {
      detail: {
        summary:
          "Link product to a potential definition (replaces its link in that Linha)",
        tags: ["Potential"],
        security: [{ bearerAuth: [] }],
      },
      params: t.Object({ id: t.Number({ minimum: 1 }) }),
      body: t.Object({
        definitionId: t.Number({ minimum: 1 }),
      }),
    },
  );

const unlinkProductRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "CATALOG"))
  // The definition is part of the path because a product may be linked in
  // several Linhas since spec 0013 §3 — the product alone no longer names a row.
  .delete(
    "/products/:id/potential-definitions/:definitionId",
    async ({ params, getScope }) => {
      const scope = await getScope();
      return potentialUseCases.unlinkProduct().execute({
        productId: params.id,
        definitionId: params.definitionId,
        scope,
      });
    },
    {
      detail: {
        summary: "Unlink product from one potential definition",
        tags: ["Potential"],
        security: [{ bearerAuth: [] }],
      },
      params: t.Object({
        id: t.Number({ minimum: 1 }),
        definitionId: t.Number({ minimum: 1 }),
      }),
    },
  );

export const potentialRoute = new Elysia()
  .use(listFacilityPotentialsRoute)
  .use(patchFacilityPotentialsRoute)
  .use(listDefinitionsRoute)
  .use(createDefinitionRoute)
  .use(updateDefinitionRoute)
  .use(deleteDefinitionRoute)
  .use(listDefinitionProductsRoute)
  .use(linkProductRoute)
  .use(unlinkProductRoute);
