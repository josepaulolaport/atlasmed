import { Elysia, t } from "elysia";
import { auth } from "../../../access/composition";
import { requirePermission } from "../../../access/infrastructure/middleware/permission.middleware";
import { ValidationError } from "../../../../shared/errors";
import { potentialUseCases } from "../../composition";

const listFacilityPotentialsRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "FACILITY", { resourceIdParam: "id" }))
  .get(
    "/facilities/:id/potentials",
    async ({ params, query, getScope }) => {
      if (!query.verticalId?.trim()) {
        throw new ValidationError([
          { field: "verticalId", message: "verticalId is required" },
        ]);
      }
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
      query: t.Object({
        verticalId: t.String({ minLength: 1 }),
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
      body: t.Object({
        verticalId: t.String({ minLength: 1 }),
        values: t.Array(
          t.Object({
            definitionId: t.String({ minLength: 1 }),
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
      if (!query.verticalId?.trim()) {
        throw new ValidationError([
          { field: "verticalId", message: "verticalId is required" },
        ]);
      }
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
        verticalId: t.String({ minLength: 1 }),
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
        verticalId: t.String({ minLength: 1 }),
        key: t.Optional(t.String()),
        label: t.String({ minLength: 1 }),
        sortOrder: t.Optional(t.Number()),
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
      body: t.Object({
        label: t.Optional(t.String({ minLength: 1 })),
        sortOrder: t.Optional(t.Number()),
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
        summary: "Link product to a potential definition (1:1)",
        tags: ["Potential"],
        security: [{ bearerAuth: [] }],
      },
      body: t.Object({
        definitionId: t.String({ minLength: 1 }),
      }),
    },
  );

const unlinkProductRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "CATALOG"))
  .delete(
    "/products/:id/potential-definition",
    async ({ params, getScope }) => {
      const scope = await getScope();
      return potentialUseCases.unlinkProduct().execute({
        productId: params.id,
        scope,
      });
    },
    {
      detail: {
        summary: "Unlink product from potential definition",
        tags: ["Potential"],
        security: [{ bearerAuth: [] }],
      },
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
