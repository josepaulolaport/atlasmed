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

// The rep records one competitor product at a time — the picker supplies the
// product, the rep types only a quantity (spec 0013 §6).
const setFacilityProductUsageRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "FACILITY", { resourceIdParam: "id" }))
  .put(
    "/facilities/:id/potentials/:definitionId/usage/:productId",
    async ({ params, body, getScope, getUserId }) => {
      const [scope, userId] = await Promise.all([getScope(), getUserId()]);
      return potentialUseCases.setFacilityProductUsage().execute({
        facilityId: params.id,
        verticalId: body.verticalId,
        definitionId: params.definitionId,
        productId: params.productId,
        quantity: body.quantity,
        userId,
        scope,
      });
    },
    {
      detail: {
        summary: "Set the quantity standing for a competitor product",
        tags: ["Potential"],
        security: [{ bearerAuth: [] }],
      },
      params: t.Object({
        id: t.Number({ minimum: 1 }),
        definitionId: t.Number({ minimum: 1 }),
        productId: t.Number({ minimum: 1 }),
      }),
      body: t.Object({
        verticalId: t.Number({ minimum: 1 }),
        // Strictly positive (§4.6). Zero is not a quantity — "they sell none
        // here" is the nenhuma-outra-marca claim, which is dated.
        quantity: t.Number({ exclusiveMinimum: 0 }),
      }),
    },
  );

const removeFacilityProductUsageRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "FACILITY", { resourceIdParam: "id" }))
  .delete(
    "/facilities/:id/potentials/:definitionId/usage/:productId",
    async ({ params, query, getScope }) => {
      const scope = await getScope();
      return potentialUseCases.removeFacilityProductUsage().execute({
        facilityId: params.id,
        verticalId: query.verticalId,
        definitionId: params.definitionId,
        productId: params.productId,
        scope,
      });
    },
    {
      detail: {
        summary: "Remove a competitor product from a metric",
        tags: ["Potential"],
        security: [{ bearerAuth: [] }],
      },
      params: t.Object({
        id: t.Number({ minimum: 1 }),
        definitionId: t.Number({ minimum: 1 }),
        productId: t.Number({ minimum: 1 }),
      }),
      query: t.Object({
        verticalId: t.Number({ minimum: 1 }),
        // No month: a competitor is removed from the metric outright. The
        // parameter was optional and no client ever sent it.
      }),
    },
  );

/**
 * The rep asserting that no other brand is sold at this clinic for this metric.
 *
 * A write, not a filter: it is the only thing that makes a 100% share
 * legitimate, so it carries the date it was asserted — a stale claim still
 * counts, and that date is the only signal it is old.
 */
const setNoOtherBrandsRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "FACILITY", { resourceIdParam: "id" }))
  .put(
    "/facilities/:id/potentials/:definitionId/no-other-brands",
    async ({ params, body, getScope, getUserId }) => {
      const [scope, userId] = await Promise.all([getScope(), getUserId()]);
      return potentialUseCases.setNoOtherBrands().execute({
        facilityId: params.id,
        verticalId: body.verticalId,
        definitionId: params.definitionId,
        value: body.value,
        userId,
        scope,
      });
    },
    {
      detail: {
        summary: "Declare that no other brand is sold at this clinic for a metric",
        tags: ["Potential"],
        security: [{ bearerAuth: [] }],
      },
      params: t.Object({
        id: t.Number({ minimum: 1 }),
        definitionId: t.Number({ minimum: 1 }),
      }),
      body: t.Object({
        verticalId: t.Number({ minimum: 1 }),
        value: t.Boolean(),
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

/**
 * The other brands a rep may record against a metric.
 *
 * Derived, not curated: a competitor product counts toward a metric when it is
 * the equivalent of one of our products linked to that metric. The catalogue
 * has no way to link a competitor to a definition, so this is the only answer
 * there is — and it is the same set the write validates against.
 */
const listDefinitionCompetitorProductsRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "CATALOG"))
  .get(
    "/potential-definitions/:id/competitor-products",
    async ({ params, getScope }) => {
      const scope = await getScope();
      return potentialUseCases.listDefinitionCompetitorProducts().execute({
        definitionId: params.id,
        scope,
      });
    },
    {
      detail: {
        summary: "List the other brands that count toward a potential metric",
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
  .use(setFacilityProductUsageRoute)
  .use(removeFacilityProductUsageRoute)
  .use(setNoOtherBrandsRoute)
  .use(listDefinitionsRoute)
  .use(createDefinitionRoute)
  .use(updateDefinitionRoute)
  .use(deleteDefinitionRoute)
  .use(listDefinitionProductsRoute)
  .use(listDefinitionCompetitorProductsRoute)
  .use(linkProductRoute)
  .use(unlinkProductRoute);
