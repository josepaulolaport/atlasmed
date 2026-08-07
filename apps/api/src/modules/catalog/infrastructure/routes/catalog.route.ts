import { Elysia, t } from "elysia";
import { auth } from "../../../access/composition";
import { requirePermission } from "../../../access/infrastructure/middleware/permission.middleware";
import { catalogUseCases } from "../../composition";
import { ResourceNotFoundError } from "../../../../shared/errors";
import { competitorProductsRoute } from "./competitor-products.route";
import { productComparisonsRoute } from "./product-comparisons.route";

const listBusinessVerticalsRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "CATALOG"))
  .get(
    "/business-verticals",
    async ({ query }) =>
      catalogUseCases.listBusinessVerticals().execute({
        page: query.page,
        limit: query.limit,
        isActive: query.isActive === "true" ? true : query.isActive === "false" ? false : undefined,
      }),
    {
      detail: { summary: "List business verticals", tags: ["Catalog"], security: [{ bearerAuth: [] }] },
      query: t.Object({
        page: t.Optional(t.Number({ minimum: 1 })),
        limit: t.Optional(t.Number({ minimum: 1 })),
        isActive: t.Optional(t.String()),
      }),
    }
  );

const createBusinessVerticalRoute = new Elysia()
  .use(auth)
  .use(requirePermission("create", "CATALOG"))
  .post(
    "/business-verticals",
    async ({ body }) => catalogUseCases.createBusinessVertical().execute(body),
    {
      detail: { summary: "Create business vertical", tags: ["Catalog"], security: [{ bearerAuth: [] }] },
      body: t.Object({
        code: t.String(),
        name: t.String(),
        isActive: t.Optional(t.Boolean()),
      }),
    }
  );

const updateBusinessVerticalRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "CATALOG"))
  .patch(
    "/business-verticals/:id",
    async ({ params, body }) => {
      const vertical = await catalogUseCases.updateBusinessVertical().execute({
        verticalId: params.id,
        ...body,
      });
      if (!vertical) throw new ResourceNotFoundError("BusinessVertical", params.id);
      return vertical;
    },
    {
      detail: { summary: "Update business vertical", tags: ["Catalog"], security: [{ bearerAuth: [] }] },
      params: t.Object({ id: t.Number({ minimum: 1 }) }),
      body: t.Object({
        code: t.Optional(t.String()),
        name: t.Optional(t.String()),
        isActive: t.Optional(t.Boolean()),
      }),
    }
  );

const listProductsRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "CATALOG"))
  .get(
    "/products",
    async ({ query, getScope, getAuthContext }) => {
      const [scope, authContext] = await Promise.all([getScope(), getAuthContext()]);
      return catalogUseCases.listProducts().execute({
        page: query.page,
        limit: query.limit,
        verticalId: query.verticalId,
        search: query.search,
        isActive: query.isActive === "true" ? true : query.isActive === "false" ? false : undefined,
        scope,
        role: authContext.roleName,
      });
    },
    {
      detail: { summary: "List products", tags: ["Catalog"], security: [{ bearerAuth: [] }] },
      query: t.Object({
        page: t.Optional(t.Number({ minimum: 1 })),
        limit: t.Optional(t.Number({ minimum: 1 })),
        verticalId: t.Optional(t.Number({ minimum: 1 })),
        search: t.Optional(t.String()),
        isActive: t.Optional(t.String()),
      }),
    }
  );

const getProductRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "CATALOG"))
  .get(
    "/products/:id",
    async ({ params, query, getScope, getAuthContext }) => {
      const [scope, authContext] = await Promise.all([getScope(), getAuthContext()]);
      return catalogUseCases.getProduct().execute({
        productId: params.id,
        scope,
        role: authContext.roleName,
        verticalId: query.verticalId,
      });
    },
    {
      detail: { summary: "Get product", tags: ["Catalog"], security: [{ bearerAuth: [] }] },
      params: t.Object({ id: t.Number({ minimum: 1 }) }),
      query: t.Object({
        verticalId: t.Optional(t.Number({ minimum: 1 })),
      }),
    }
  );

const createProductRoute = new Elysia()
  .use(auth)
  .use(requirePermission("create", "CATALOG"))
  .post(
    "/products",
    async ({ body }) =>
      catalogUseCases.createProduct().execute({
        ...body,
        verticalIds: body.verticalIds,
      }),
    {
      detail: { summary: "Create product", tags: ["Catalog"], security: [{ bearerAuth: [] }] },
      body: t.Object({
        code: t.String(),
        name: t.String(),
        verticalIds: t.Array(t.Number({ minimum: 1 }), { minItems: 1 }),
        pictureUrl: t.Optional(t.Nullable(t.String())),
        simproCode: t.String(),
        brasindiceCode: t.String(),
        tissCode: t.String(),
        manufacturer: t.String(),
        countryOfOrigin: t.String(),
        price: t.Number(),
        price17: t.Number(),
        price18: t.Number(),
        price20: t.Number(),
        brasindiceUpdatedAt: t.String(),
        isActive: t.Optional(t.Boolean()),
      }),
    }
  );

const updateProductRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "CATALOG"))
  .patch(
    "/products/:id",
    async ({ params, body }) => {
      const { verticalIds: rawVerticalIds, ...rest } = body;
      return catalogUseCases.updateProduct().execute({
        productId: params.id,
        ...rest,
        ...(rawVerticalIds
          ? { verticalIds: rawVerticalIds }
          : {}),
      });
    },
    {
      detail: { summary: "Update product", tags: ["Catalog"], security: [{ bearerAuth: [] }] },
      params: t.Object({ id: t.Number({ minimum: 1 }) }),
      body: t.Object({
        code: t.Optional(t.String()),
        name: t.Optional(t.String()),
        verticalIds: t.Optional(t.Array(t.Number({ minimum: 1 }), { minItems: 1 })),
        pictureUrl: t.Optional(t.Nullable(t.String())),
        simproCode: t.Optional(t.String()),
        brasindiceCode: t.Optional(t.String()),
        tissCode: t.Optional(t.String()),
        manufacturer: t.Optional(t.String()),
        countryOfOrigin: t.Optional(t.String()),
        price: t.Optional(t.Number()),
        price17: t.Optional(t.Number()),
        price18: t.Optional(t.Number()),
        price20: t.Optional(t.Number()),
        brasindiceUpdatedAt: t.Optional(t.String()),
        isActive: t.Optional(t.Boolean()),
      }),
    }
  );

// Field reps need this catalog when editing facility payer mix (Fontes Pagadoras).
// CRUD of providers stays on CATALOG; listing for picker is facility-scoped read.
const listHealthcareProvidersRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "FACILITY"))
  .get(
    "/healthcare-providers",
    async ({ query }) =>
      catalogUseCases.listHealthcareProviders().execute({
        page: query.page,
        limit: query.limit,
        isActive: query.isActive === "true" ? true : query.isActive === "false" ? false : undefined,
      }),
    {
      detail: {
        summary: "List healthcare providers",
        tags: ["Catalog"],
        security: [{ bearerAuth: [] }],
      },
      query: t.Object({
        page: t.Optional(t.Number({ minimum: 1 })),
        limit: t.Optional(t.Number({ minimum: 1 })),
        isActive: t.Optional(t.String()),
      }),
    }
  );

const createHealthcareProviderRoute = new Elysia()
  .use(auth)
  .use(requirePermission("create", "CATALOG"))
  .post(
    "/healthcare-providers",
    async ({ body }) => catalogUseCases.createHealthcareProvider().execute(body),
    {
      detail: {
        summary: "Create healthcare provider",
        tags: ["Catalog"],
        security: [{ bearerAuth: [] }],
      },
      body: t.Object({
        name: t.String(),
        type: t.Union([
          t.Literal("PRIVATE"),
          t.Literal("PUBLIC"),
          t.Literal("MIXED"),
          t.Literal("OTHER"),
        ]),
        isActive: t.Optional(t.Boolean()),
      }),
    }
  );

const updateHealthcareProviderRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "CATALOG"))
  .patch(
    "/healthcare-providers/:id",
    async ({ params, body }) =>
      catalogUseCases.updateHealthcareProvider().execute({
        providerId: params.id,
        ...body,
      }),
    {
      detail: {
        summary: "Update healthcare provider",
        tags: ["Catalog"],
        security: [{ bearerAuth: [] }],
      },
      params: t.Object({ id: t.Number({ minimum: 1 }) }),
      body: t.Object({
        name: t.Optional(t.String()),
        type: t.Optional(
          t.Union([
            t.Literal("PRIVATE"),
            t.Literal("PUBLIC"),
            t.Literal("MIXED"),
            t.Literal("OTHER"),
          ])
        ),
        isActive: t.Optional(t.Boolean()),
      }),
    }
  );

const listFacilitySharesRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "FACILITY", { resourceIdParam: "id" }))
  .get(
    "/facilities/:id/healthcare-provider-shares",
    async ({ params, getScope }) => {
      const scope = await getScope();
      return catalogUseCases.listFacilityShares().execute({
        facilityId: params.id,
        scope,
      });
    },
    {
      detail: {
        summary: "List facility healthcare provider shares",
        tags: ["Catalog"],
        security: [{ bearerAuth: [] }],
      },
      params: t.Object({ id: t.Number({ minimum: 1 }) }),
    }
  );

const createFacilityShareRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "FACILITY", { resourceIdParam: "id" }))
  .post(
    "/facilities/:id/healthcare-provider-shares",
    async ({ params, body, getScope }) => {
      const scope = await getScope();
      return catalogUseCases.createFacilityShare().execute({
        facilityId: params.id,
        healthcareProviderId: body.healthcareProviderId,
        sharePercent: body.sharePercent,
        isPackage: body.isPackage,
        scope,
      });
    },
    {
      detail: {
        summary: "Create facility healthcare provider share",
        tags: ["Catalog"],
        security: [{ bearerAuth: [] }],
      },
      params: t.Object({ id: t.Number({ minimum: 1 }) }),
      body: t.Object({
        healthcareProviderId: t.Number({ minimum: 1 }),
        sharePercent: t.Number(),
        isPackage: t.Optional(t.Boolean()),
      }),
    }
  );

const replaceFacilitySharesRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "FACILITY", { resourceIdParam: "id" }))
  .put(
    "/facilities/:id/healthcare-provider-shares",
    async ({ params, body, getScope }) => {
      const scope = await getScope();
      return catalogUseCases.replaceFacilityShares().execute({
        facilityId: params.id,
        scope,
        shares: body.shares,
      });
    },
    {
      detail: {
        summary: "Replace facility healthcare provider share mix",
        tags: ["Catalog"],
        security: [{ bearerAuth: [] }],
      },
      params: t.Object({ id: t.Number({ minimum: 1 }) }),
      body: t.Object({
        shares: t.Array(
          t.Object({
            healthcareProviderId: t.Number({ minimum: 1 }),
            sharePercent: t.Number(),
            isPackage: t.Optional(t.Boolean()),
          })
        ),
      }),
    }
  );

export const catalogRoute = new Elysia()
  .use(listBusinessVerticalsRoute)
  .use(createBusinessVerticalRoute)
  .use(updateBusinessVerticalRoute)
  .use(listProductsRoute)
  .use(getProductRoute)
  .use(createProductRoute)
  .use(updateProductRoute)
  .use(listHealthcareProvidersRoute)
  .use(createHealthcareProviderRoute)
  .use(updateHealthcareProviderRoute)
  .use(listFacilitySharesRoute)
  .use(createFacilityShareRoute)
  .use(replaceFacilitySharesRoute)
  .use(competitorProductsRoute)
  .use(productComparisonsRoute);
