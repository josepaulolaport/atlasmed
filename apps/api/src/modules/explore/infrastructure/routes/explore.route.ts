import { Elysia, t } from "elysia";
import { auth } from "../../../access/composition";
import { exploreUseCases } from "../../composition";
import { ResourceNotFoundError } from "../../../../shared/errors";

function parseCsv(value?: string): string[] {
  if (!value?.trim()) return [];
  return value.split(",").map((part) => part.trim()).filter(Boolean);
}

export const exploreRoute = new Elysia()
  .use(auth)
  .get(
    "/facilities",
    async ({ query }) => {
      return await exploreUseCases.listFacilities({
        page: query.page ? Number(query.page) : undefined,
        limit: query.limit ? Number(query.limit) : undefined,
        search: query.search,
        stateCodes: parseCsv(query.stateCode),
        cities: parseCsv(query.city),
        facilityTypes: parseCsv(query.facilityType),
      });
    },
    {
      detail: {
        summary: "List establishments from mcp_test",
        tags: ["Explore"],
        security: [{ bearerAuth: [] }],
      },
      query: t.Object({
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        search: t.Optional(t.String()),
        stateCode: t.Optional(t.String()),
        city: t.Optional(t.String()),
        facilityType: t.Optional(t.String()),
      }),
    },
  )
  .get(
    "/facilities/filter-options",
    async () => exploreUseCases.listFacilityFilterOptions(),
    {
      detail: {
        summary: "List facility filter options",
        tags: ["Explore"],
        security: [{ bearerAuth: [] }],
      },
    },
  )
  .get(
    "/facilities/filter-options/cities",
    async ({ query }) =>
      exploreUseCases.listFacilityCities({
        search: query.search,
        stateCodes: parseCsv(query.stateCode),
        limit: query.limit ? Number(query.limit) : undefined,
      }),
    {
      detail: {
        summary: "Search cities for facility filters",
        tags: ["Explore"],
        security: [{ bearerAuth: [] }],
      },
      query: t.Object({
        search: t.Optional(t.String()),
        stateCode: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
    },
  )
  .get(
    "/facilities/:id",
    async ({ params }) => {
      const facility = await exploreUseCases.getFacility(params.id);
      if (!facility) {
        throw new ResourceNotFoundError("Facility", params.id);
      }
      return facility;
    },
    {
      detail: {
        summary: "Get establishment detail",
        tags: ["Explore"],
        security: [{ bearerAuth: [] }],
      },
    },
  )
  .get(
    "/professionals",
    async ({ query }) => {
      return await exploreUseCases.listProfessionals({
        page: query.page ? Number(query.page) : undefined,
        limit: query.limit ? Number(query.limit) : undefined,
        search: query.search,
      });
    },
    {
      detail: {
        summary: "List professionals from mcp_test",
        tags: ["Explore"],
        security: [{ bearerAuth: [] }],
      },
      query: t.Object({
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        search: t.Optional(t.String()),
      }),
    },
  )
  .get(
    "/professionals/:id",
    async ({ params }) => {
      const professional = await exploreUseCases.getProfessional(params.id);
      if (!professional) {
        throw new ResourceNotFoundError("Professional", params.id);
      }
      return professional;
    },
    {
      detail: {
        summary: "Get professional detail",
        tags: ["Explore"],
        security: [{ bearerAuth: [] }],
      },
    },
  );
