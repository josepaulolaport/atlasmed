import { Elysia, t } from "elysia";
import { auth } from "../../../access/composition";
import { requirePermission } from "../../../access/infrastructure/middleware/permission.middleware";
import { catalogUseCases } from "../../composition";

const listCompetitorProductsRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "CATALOG"))
  .get(
    "/competitor-products",
    async ({ query }) =>
      catalogUseCases.listCompetitorProducts().execute({
        page: query.page,
        limit: query.limit,
        search: query.search,
        isActive: query.isActive === "true" ? true : query.isActive === "false" ? false : undefined,
      }),
    {
      detail: {
        summary: "List competitor products",
        tags: ["Catalog"],
        security: [{ bearerAuth: [] }],
      },
      query: t.Object({
        page: t.Optional(t.Number({ minimum: 1 })),
        limit: t.Optional(t.Number({ minimum: 1 })),
        search: t.Optional(t.String()),
        isActive: t.Optional(t.String()),
      }),
    }
  );

const getCompetitorProductRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "CATALOG"))
  .get(
    "/competitor-products/:id",
    async ({ params }) =>
      catalogUseCases.getCompetitorProduct().execute({
        competitorProductId: params.id,
      }),
    {
      detail: {
        summary: "Get competitor product",
        tags: ["Catalog"],
        security: [{ bearerAuth: [] }],
      },
      params: t.Object({ id: t.Number({ minimum: 1 }) }),
    }
  );

const createCompetitorProductRoute = new Elysia()
  .use(auth)
  .use(requirePermission("create", "CATALOG"))
  .post(
    "/competitor-products",
    async ({ body }) => catalogUseCases.createCompetitorProduct().execute(body),
    {
      detail: {
        summary: "Create competitor product",
        tags: ["Catalog"],
        security: [{ bearerAuth: [] }],
      },
      body: t.Object({
        code: t.Optional(t.Nullable(t.String())),
        name: t.String(),
        manufacturer: t.String(),
        brand: t.Optional(t.Nullable(t.String())),
        countryOfOrigin: t.String(),
        price17: t.Number(),
        price18: t.Number(),
        price20: t.Number(),
        brasindiceUpdatedAt: t.String(),
        isActive: t.Optional(t.Boolean()),
      }),
    }
  );

const updateCompetitorProductRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "CATALOG"))
  .patch(
    "/competitor-products/:id",
    async ({ params, body }) =>
      catalogUseCases
        .updateCompetitorProduct()
        .execute({
          competitorProductId: params.id,
          ...body,
        }),
    {
      detail: {
        summary: "Update competitor product",
        tags: ["Catalog"],
        security: [{ bearerAuth: [] }],
      },
      params: t.Object({ id: t.Number({ minimum: 1 }) }),
      body: t.Object({
        code: t.Optional(t.Nullable(t.String())),
        name: t.Optional(t.String()),
        manufacturer: t.Optional(t.String()),
        brand: t.Optional(t.Nullable(t.String())),
        countryOfOrigin: t.Optional(t.String()),
        price17: t.Optional(t.Number()),
        price18: t.Optional(t.Number()),
        price20: t.Optional(t.Number()),
        brasindiceUpdatedAt: t.Optional(t.String()),
        isActive: t.Optional(t.Boolean()),
      }),
    }
  );

export const competitorProductsRoute = new Elysia()
  .use(listCompetitorProductsRoute)
  .use(getCompetitorProductRoute)
  .use(createCompetitorProductRoute)
  .use(updateCompetitorProductRoute);
