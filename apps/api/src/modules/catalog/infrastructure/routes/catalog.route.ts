import { Elysia, t } from "elysia";
import { auth } from "../../../access/composition";
import { requirePermission } from "../../../access/infrastructure/middleware/permission.middleware";
import { catalogUseCases } from "../../composition";
import { ResourceNotFoundError, ValidationError } from "../../../../shared/errors";
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
      // No `code`: it is immutable after creation (spec 0016 §4.1) — a stable
      // key other data joins on by meaning.
      body: t.Object({
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

/**
 * The columns an admin may set on a product.
 *
 * Nullable where the schema is nullable. Until spec 0016 §5.1 this route
 * required `code`, `simproCode`, `brasindiceCode`, `tissCode` and
 * `brasindiceUpdatedAt` as non-null strings — which spec 0013 §2 had already
 * made nullable *on purpose*, so that the Emultec importer would stop inventing
 * `EMULTEC-SIM-{id}` values to satisfy a constraint that guaranteed a string
 * rather than a code. The migration landed and the route did not follow, so an
 * admin registering a product by hand was forced to invent exactly the
 * synthetic codes the spec removed.
 *
 * Two fields are absent by decision:
 * - `metricUnits` — informative, no writer anywhere (spec 0016 §7.1).
 * - `ownership` — chosen by the endpoint, never by a field (§6.1).
 */
const productWritableFields = {
  code: t.Optional(t.Nullable(t.String())),
  name: t.String({ minLength: 1 }),
  description: t.Optional(t.Nullable(t.String())),
  commercialCode: t.Optional(t.Nullable(t.String())),
  productGroup: t.Optional(t.Nullable(t.String())),
  productClassification: t.Optional(t.Nullable(t.String())),
  internalClassification: t.Optional(t.Nullable(t.String())),
  brand: t.Optional(t.Nullable(t.String())),
  unit: t.Optional(t.Nullable(t.String())),
  barcode: t.Optional(t.Nullable(t.String())),
  ncm: t.Optional(t.Nullable(t.String())),
  anvisaRegistration: t.Optional(t.Nullable(t.String())),
  requiresSterilization: t.Optional(t.Boolean()),
  idProdutoEmultec: t.Optional(t.Nullable(t.Number({ minimum: 1 }))),
  // `pictureUrl` is absent by decision: it names an object this API stores, so
  // it is written by `POST`/`DELETE /products/:id/picture` and by nothing else.
  // As a body field it let a product point at any URL on the internet.
  simproCode: t.Optional(t.Nullable(t.String())),
  brasindiceCode: t.Optional(t.Nullable(t.String())),
  tissCode: t.Optional(t.Nullable(t.String())),
  manufacturer: t.String({ minLength: 1 }),
  countryOfOrigin: t.String({ minLength: 1 }),
  price: t.Optional(t.Nullable(t.Number())),
  price17: t.Optional(t.Number()),
  price18: t.Optional(t.Number()),
  price20: t.Optional(t.Number()),
  brasindiceUpdatedAt: t.Optional(t.Nullable(t.String())),
  isActive: t.Optional(t.Boolean()),
} as const;

const createProductRoute = new Elysia()
  .use(auth)
  .use(requirePermission("create", "CATALOG"))
  .post(
    "/products",
    async ({ body }) => catalogUseCases.createProduct().execute(body),
    {
      detail: { summary: "Create product", tags: ["Catalog"], security: [{ bearerAuth: [] }] },
      body: t.Object({
        ...productWritableFields,
        // The only chance to choose: a product's Linhas are immutable after
        // creation (spec 0016 §6.7), so `PATCH` does not accept them.
        verticalIds: t.Array(t.Number({ minimum: 1 }), { minItems: 1 }),
      }),
    }
  );

const updateProductRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "CATALOG"))
  .patch(
    "/products/:id",
    async ({ params, body }) =>
      catalogUseCases.updateProduct().execute({ productId: params.id, ...body }),
    {
      detail: { summary: "Update product", tags: ["Catalog"], security: [{ bearerAuth: [] }] },
      params: t.Object({ id: t.Number({ minimum: 1 }) }),
      // Every field optional, and no `verticalIds`: moving a product between
      // Linhas is forbidden (spec 0016 §6.7) because orders key on
      // `facility_vertical_profile_id` and `product_potential_links` is unique
      // per (product, vertical) — so a move silently changes which profiles the
      // product's sales join to and orphans its metric link.
      body: t.Object({
        ...productWritableFields,
        name: t.Optional(t.String({ minLength: 1 })),
        manufacturer: t.Optional(t.String({ minLength: 1 })),
        countryOfOrigin: t.Optional(t.String({ minLength: 1 })),
      }),
    }
  );

/**
 * Deletes a product, and only while nothing references it (spec 0016 §6.2).
 *
 * 409 `RESOURCE_IN_USE` when something does, carrying the counts, so the client
 * can name what blocks it and offer deactivation instead. Not a soft delete:
 * that is what `isActive` is for, and having both would be two ways to say the
 * same thing.
 */
const deleteProductRoute = new Elysia()
  .use(auth)
  .use(requirePermission("delete", "CATALOG"))
  .delete(
    "/products/:id",
    async ({ params }) =>
      catalogUseCases.deleteProduct().execute({ productId: params.id }),
    {
      detail: {
        summary: "Delete a product that nothing references",
        tags: ["Catalog"],
        security: [{ bearerAuth: [] }],
      },
      params: t.Object({ id: t.Number({ minimum: 1 }) }),
    }
  );

/**
 * The product picture (spec 0016 §4.2).
 *
 * Registered **before** `/products/:id` so `pictures` is not routed as a
 * product id — the same ordering `facilities.route.ts` documents for
 * `clinical-focuses`.
 *
 * Read permission rather than CATALOG-update: reps see the picture in the
 * product list, and gating the bytes behind an admin permission would show
 * them a broken image.
 */
const downloadProductPictureRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "CATALOG"))
  .get(
    "/products/pictures/*",
    async ({ params, set }) => {
      const key = params["*"];
      if (typeof key !== "string") {
        throw new ValidationError([
          { field: "key", message: "Invalid product picture key" },
        ]);
      }
      const result = await catalogUseCases
        .downloadProductPicture()
        .execute({ storageKey: key });
      set.headers["content-type"] = result.contentType;
      set.headers["cache-control"] = "private, max-age=3600";
      return result.bytes;
    },
    {
      detail: {
        summary: "Download a product picture by storage key",
        tags: ["Catalog"],
        security: [{ bearerAuth: [] }],
      },
    }
  );

const uploadProductPictureRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "CATALOG"))
  .post(
    "/products/:id/picture",
    async ({ params, body }) => {
      const picture = body.picture;
      if (!(picture instanceof File)) {
        throw new ValidationError([
          { field: "picture", message: "Picture file is required" },
        ]);
      }
      return catalogUseCases
        .uploadProductPicture()
        .execute({ productId: params.id, file: picture });
    },
    {
      detail: {
        summary: "Upload the picture of a product",
        tags: ["Catalog"],
        security: [{ bearerAuth: [] }],
      },
      params: t.Object({ id: t.Number({ minimum: 1 }) }),
      body: t.Object({
        picture: t.File({ description: "JPEG, PNG, or WebP image up to 5 MB" }),
      }),
    }
  );

const removeProductPictureRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "CATALOG"))
  .delete(
    "/products/:id/picture",
    async ({ params }) =>
      catalogUseCases.removeProductPicture().execute({ productId: params.id }),
    {
      detail: {
        summary: "Remove the picture of a product",
        tags: ["Catalog"],
        security: [{ bearerAuth: [] }],
      },
      params: t.Object({ id: t.Number({ minimum: 1 }) }),
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
  // Before `/products/:id` so `pictures` is not captured as a product id.
  .use(downloadProductPictureRoute)
  .use(getProductRoute)
  .use(createProductRoute)
  .use(updateProductRoute)
  .use(deleteProductRoute)
  .use(uploadProductPictureRoute)
  .use(removeProductPictureRoute)
  .use(listHealthcareProvidersRoute)
  .use(createHealthcareProviderRoute)
  .use(updateHealthcareProviderRoute)
  .use(listFacilitySharesRoute)
  .use(createFacilityShareRoute)
  .use(replaceFacilitySharesRoute)
  .use(competitorProductsRoute)
  .use(productComparisonsRoute);
