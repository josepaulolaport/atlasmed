import { Elysia, t } from "elysia";
import { auth } from "../../../access/composition";
import { requirePermission } from "../../../access/infrastructure/middleware/permission.middleware";
import { catalogUseCases } from "../../composition";

/// Same bound as the products route — `numeric(12,2)`, never negative.
const PRICE = t.Number({ minimum: 0, maximum: 9999999999.99 });

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
      // `brasindiceUpdatedAt` is optional and nullable. It was a required
      // string, and nothing in the app could supply one — the competitor form
      // has no date field — so registering a brand answered 422 every time. The
      // column is meaningless without a `brasindice_code` (spec 0013 §2), which
      // no competitor row has.
      body: t.Object({
        code: t.Optional(t.Nullable(t.String())),
        name: t.String({ minLength: 1 }),
        manufacturer: t.String({ minLength: 1 }),
        brand: t.Optional(t.Nullable(t.String())),
        countryOfOrigin: t.String({ minLength: 1 }),
        price17: PRICE,
        price18: PRICE,
        price20: PRICE,
        brasindiceUpdatedAt: t.Optional(t.Nullable(t.String())),
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
        price17: t.Optional(PRICE),
        price18: t.Optional(PRICE),
        price20: t.Optional(PRICE),
        brasindiceUpdatedAt: t.Optional(t.Nullable(t.String())),
        isActive: t.Optional(t.Boolean()),
      }),
    }
  );

/** Same conditional delete as our own products — spec 0016 §6.2. */
const deleteCompetitorProductRoute = new Elysia()
  .use(auth)
  .use(requirePermission("delete", "CATALOG"))
  .delete(
    "/competitor-products/:id",
    async ({ params }) =>
      catalogUseCases
        .deleteCompetitorProduct()
        .execute({ competitorProductId: params.id }),
    {
      detail: {
        summary: "Delete a competitor product that nothing references",
        tags: ["Catalog"],
        security: [{ bearerAuth: [] }],
      },
      params: t.Object({ id: t.Number({ minimum: 1 }) }),
    }
  );

export const competitorProductsRoute = new Elysia()
  .use(listCompetitorProductsRoute)
  .use(getCompetitorProductRoute)
  .use(createCompetitorProductRoute)
  .use(updateCompetitorProductRoute)
  .use(deleteCompetitorProductRoute);
