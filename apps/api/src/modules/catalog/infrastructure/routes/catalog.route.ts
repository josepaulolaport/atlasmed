import { Elysia, t } from "elysia";
import { auth } from "../../../access/composition";
import { requirePermission } from "../../../access/infrastructure/middleware/permission.middleware";
import { catalogUseCases } from "../../composition";
import { ResourceNotFoundError } from "../../../../shared/errors";

const listSectorsRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "CATALOG"))
  .get(
    "/sectors",
    async ({ query }) =>
      catalogUseCases.listSectors().execute({
        page: query.page ? Number(query.page) : undefined,
        limit: query.limit ? Number(query.limit) : undefined,
        isActive: query.isActive === "true" ? true : query.isActive === "false" ? false : undefined,
      }),
    {
      detail: { summary: "List sectors", tags: ["Catalog"], security: [{ bearerAuth: [] }] },
      query: t.Object({
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        isActive: t.Optional(t.String()),
      }),
    }
  );

const createSectorRoute = new Elysia()
  .use(auth)
  .use(requirePermission("create", "CATALOG"))
  .post(
    "/sectors",
    async ({ body }) => catalogUseCases.createSector().execute(body),
    {
      detail: { summary: "Create sector", tags: ["Catalog"], security: [{ bearerAuth: [] }] },
      body: t.Object({
        slug: t.String(),
        name: t.String(),
        isActive: t.Optional(t.Boolean()),
      }),
    }
  );

const updateSectorRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "CATALOG"))
  .patch(
    "/sectors/:id",
    async ({ params, body }) => {
      const sector = await catalogUseCases.updateSector().execute({
        sectorId: params.id,
        ...body,
      });
      if (!sector) throw new ResourceNotFoundError("Sector", params.id);
      return sector;
    },
    {
      detail: { summary: "Update sector", tags: ["Catalog"], security: [{ bearerAuth: [] }] },
      body: t.Object({
        slug: t.Optional(t.String()),
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
    async ({ query }) =>
      catalogUseCases.listProducts().execute({
        page: query.page ? Number(query.page) : undefined,
        limit: query.limit ? Number(query.limit) : undefined,
        sectorId: query.sectorId,
        isActive: query.isActive === "true" ? true : query.isActive === "false" ? false : undefined,
      }),
    {
      detail: { summary: "List products", tags: ["Catalog"], security: [{ bearerAuth: [] }] },
      query: t.Object({
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        sectorId: t.Optional(t.String()),
        isActive: t.Optional(t.String()),
      }),
    }
  );

const createProductRoute = new Elysia()
  .use(auth)
  .use(requirePermission("create", "CATALOG"))
  .post(
    "/products",
    async ({ body }) => catalogUseCases.createProduct().execute(body),
    {
      detail: { summary: "Create product", tags: ["Catalog"], security: [{ bearerAuth: [] }] },
      body: t.Object({
        code: t.String(),
        name: t.String(),
        sectorId: t.String(),
        isActive: t.Optional(t.Boolean()),
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
      body: t.Object({
        code: t.Optional(t.String()),
        name: t.Optional(t.String()),
        sectorId: t.Optional(t.String()),
        isActive: t.Optional(t.Boolean()),
      }),
    }
  );

const listHealthcareProvidersRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "CATALOG"))
  .get(
    "/healthcare-providers",
    async ({ query }) =>
      catalogUseCases.listHealthcareProviders().execute({
        page: query.page ? Number(query.page) : undefined,
        limit: query.limit ? Number(query.limit) : undefined,
        isActive: query.isActive === "true" ? true : query.isActive === "false" ? false : undefined,
      }),
    {
      detail: {
        summary: "List healthcare providers",
        tags: ["Catalog"],
        security: [{ bearerAuth: [] }],
      },
      query: t.Object({
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
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
      catalogUseCases.updateHealthcareProvider().execute({ providerId: params.id, ...body }),
    {
      detail: {
        summary: "Update healthcare provider",
        tags: ["Catalog"],
        security: [{ bearerAuth: [] }],
      },
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
  .use(requirePermission("read", "FACILITY", { resourceIdParam: "facilityId" }))
  .get(
    "/facilities/:facilityId/healthcare-provider-shares",
    async ({ params, getScope }) => {
      const scope = await getScope();
      return catalogUseCases.listFacilityShares().execute({
        facilityId: params.facilityId,
        scope,
      });
    },
    {
      detail: {
        summary: "List facility healthcare provider shares",
        tags: ["Catalog"],
        security: [{ bearerAuth: [] }],
      },
    }
  );

const createFacilityShareRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "FACILITY", { resourceIdParam: "facilityId" }))
  .post(
    "/facilities/:facilityId/healthcare-provider-shares",
    async ({ params, body, getScope }) => {
      const scope = await getScope();
      return catalogUseCases.createFacilityShare().execute({
        facilityId: params.facilityId,
        healthcareProviderId: body.healthcareProviderId,
        sharePercent: body.sharePercent,
        scope,
      });
    },
    {
      detail: {
        summary: "Create facility healthcare provider share",
        tags: ["Catalog"],
        security: [{ bearerAuth: [] }],
      },
      body: t.Object({
        healthcareProviderId: t.String(),
        sharePercent: t.Number(),
      }),
    }
  );

export const catalogRoute = new Elysia()
  .use(listSectorsRoute)
  .use(createSectorRoute)
  .use(updateSectorRoute)
  .use(listProductsRoute)
  .use(createProductRoute)
  .use(updateProductRoute)
  .use(listHealthcareProvidersRoute)
  .use(createHealthcareProviderRoute)
  .use(updateHealthcareProviderRoute)
  .use(listFacilitySharesRoute)
  .use(createFacilityShareRoute);
