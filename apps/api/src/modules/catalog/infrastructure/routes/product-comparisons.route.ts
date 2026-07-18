import { Elysia, t } from "elysia";
import { auth } from "../../../access/composition";
import { requirePermission } from "../../../access/infrastructure/middleware/permission.middleware";
import { catalogUseCases } from "../../composition";

const sortByQuery = t.Optional(
  t.Union([t.Literal("icms17"), t.Literal("icms18"), t.Literal("icms20")])
);

const getPriceIndexRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "CATALOG"))
  .get(
    "/price-index",
    async ({ query }) => catalogUseCases.getPriceIndex().execute({ sortBy: query.sortBy }),
    {
      detail: {
        summary: "Get the full Brasíndice/Simpro price index (AtlasMed + competitor products)",
        tags: ["Catalog"],
        security: [{ bearerAuth: [] }],
      },
      query: t.Object({ sortBy: sortByQuery }),
    }
  );

const getProductComparisonRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "CATALOG"))
  .get(
    "/products/:id/comparison",
    async ({ params, query }) =>
      catalogUseCases.getProductComparison().execute({ productId: params.id, sortBy: query.sortBy }),
    {
      detail: {
        summary: "Get the price comparison ('comparativo') for a single product",
        tags: ["Catalog"],
        security: [{ bearerAuth: [] }],
      },
      query: t.Object({ sortBy: sortByQuery }),
    }
  );

const listUnlinkedCompetitorProductsRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "CATALOG"))
  .get(
    "/products/:id/competitors/unlinked",
    async ({ params }) =>
      catalogUseCases.listUnlinkedCompetitorProducts().execute({ productId: params.id }),
    {
      detail: {
        summary: "List competitor products not yet linked to this product",
        tags: ["Catalog"],
        security: [{ bearerAuth: [] }],
      },
    }
  );

const linkCompetitorProductRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "CATALOG"))
  .post(
    "/products/:id/competitors",
    async ({ params, body }) =>
      catalogUseCases.linkCompetitorProduct().execute({
        productId: params.id,
        competitorProductId: body.competitorProductId,
        notes: body.notes,
      }),
    {
      detail: {
        summary: "Link a competitor product to this product's comparison",
        tags: ["Catalog"],
        security: [{ bearerAuth: [] }],
      },
      body: t.Object({
        competitorProductId: t.String(),
        notes: t.Optional(t.Nullable(t.String())),
      }),
    }
  );

const unlinkCompetitorProductRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "CATALOG"))
  .delete(
    "/products/:id/competitors/:competitorProductId",
    async ({ params }) =>
      catalogUseCases.unlinkCompetitorProduct().execute({
        productId: params.id,
        competitorProductId: params.competitorProductId,
      }),
    {
      detail: {
        summary: "Unlink a competitor product from this product's comparison",
        tags: ["Catalog"],
        security: [{ bearerAuth: [] }],
      },
    }
  );

export const productComparisonsRoute = new Elysia()
  .use(getPriceIndexRoute)
  .use(getProductComparisonRoute)
  .use(listUnlinkedCompetitorProductsRoute)
  .use(linkCompetitorProductRoute)
  .use(unlinkCompetitorProductRoute);
