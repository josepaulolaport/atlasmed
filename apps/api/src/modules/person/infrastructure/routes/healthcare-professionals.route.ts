import { Elysia, t } from "elysia";
import { auth } from "../../../access/composition";
import { requirePermission } from "../../../access/infrastructure/middleware/permission.middleware";
import { parseListHealthcareProfessionalsQuery } from "../../application/list-healthcare-professionals-query";
import { personUseCases } from "../../composition";

type Executable = { execute(input?: any): Promise<any> };

export interface HealthcareProfessionalsHttpUseCases {
  listHealthcareProfessionals(): Executable;
  listHealthcareSpecialties(): Executable;
  addPersonBookmark(): Executable;
  removePersonBookmark(): Executable;
  listPersonBookmarks(): Executable;
}

/** Static path — must register before any `/healthcare-professionals/:id`. */
const listHealthcareSpecialtiesRoute = (
  useCases: HealthcareProfessionalsHttpUseCases,
  authPlugin: any = auth
) =>
  new Elysia()
    .use(authPlugin)
    .use(requirePermission("read", "PERSON"))
    .get(
      "/healthcare-professionals/specialties",
      async () => useCases.listHealthcareSpecialties().execute(),
      {
        detail: {
          summary:
            "Distinct active specialty names used by non-deleted persons",
          tags: ["Persons"],
          security: [{ bearerAuth: [] }],
        },
      }
    );

const listHealthcareProfessionalsRoute = (
  useCases: HealthcareProfessionalsHttpUseCases,
  authPlugin: any = auth
) =>
  new Elysia()
    .use(authPlugin)
    .use(requirePermission("read", "PERSON"))
    .get(
      "/healthcare-professionals",
      async ({ query, getScope, getUser }) => {
        const user = await getUser();
        const scope = await getScope();
        const filters = parseListHealthcareProfessionalsQuery(query);
        return useCases.listHealthcareProfessionals().execute({
          page: query.page,
          limit: query.limit,
          search: query.search,
          facilityId: query.facilityId,
          excludeFacilityId: query.excludeFacilityId,
          userId: user.id,
          role: user.role.name,
          ...filters,
          scope,
        });
      },
      {
        detail: {
          summary:
            "List healthcare professionals (Meili when searching; SQL otherwise)",
          tags: ["Persons"],
          security: [{ bearerAuth: [] }],
        },
        query: t.Object({
          page: t.Optional(t.Number({ minimum: 1 })),
          limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
          search: t.Optional(t.String()),
          facilityId: t.Optional(t.Number({ minimum: 1 })),
          excludeFacilityId: t.Optional(t.Number({ minimum: 1 })),
          latitude: t.Optional(t.String()),
          longitude: t.Optional(t.String()),
          radiusKm: t.Optional(t.String()),
          specialty: t.Optional(t.String()),
          sort: t.Optional(t.String()),
          order: t.Optional(t.String()),
        }),
      }
    );

/**
 * Favoritos — doctors.
 *
 * Gated on `read` for the same reason as clinics: saving changes nothing about
 * the doctor, only the caller's own row. A doctor has no scope of their own, so
 * the use case checks that at least one of their clinics is visible.
 */
const addPersonBookmarkRoute = (
  useCases: HealthcareProfessionalsHttpUseCases,
  authPlugin: any = auth
) =>
  new Elysia()
    .use(authPlugin)
    .use(requirePermission("read", "PERSON", { resourceIdParam: "id" }))
    .put(
      "/healthcare-professionals/:id/bookmark",
      async ({ params, getScope, getUserId }: any) => {
        const [scope, userId] = await Promise.all([getScope(), getUserId()]);
        return useCases
          .addPersonBookmark()
          .execute({ personId: params.id, userId, scope });
      },
      {
        params: t.Object({ id: t.Number({ minimum: 1 }) }),
        detail: {
          summary: "Save a doctor to the caller's favourites",
          tags: ["Healthcare Professionals"],
          security: [{ bearerAuth: [] }],
        },
      }
    );

const removePersonBookmarkRoute = (
  useCases: HealthcareProfessionalsHttpUseCases,
  authPlugin: any = auth
) =>
  new Elysia()
    .use(authPlugin)
    .use(requirePermission("read", "PERSON", { resourceIdParam: "id" }))
    .delete(
      "/healthcare-professionals/:id/bookmark",
      async ({ params, getScope, getUserId }: any) => {
        const [scope, userId] = await Promise.all([getScope(), getUserId()]);
        return useCases
          .removePersonBookmark()
          .execute({ personId: params.id, userId, scope });
      },
      {
        params: t.Object({ id: t.Number({ minimum: 1 }) }),
        detail: {
          summary: "Remove a doctor from the caller's favourites",
          tags: ["Healthcare Professionals"],
          security: [{ bearerAuth: [] }],
        },
      }
    );

/** Under `/me/` so it cannot be captured by `/healthcare-professionals/:id`. */
const listPersonBookmarksRoute = (
  useCases: HealthcareProfessionalsHttpUseCases,
  authPlugin: any = auth
) =>
  new Elysia()
    .use(authPlugin)
    .use(requirePermission("read", "PERSON"))
    .get(
      "/me/bookmarks/healthcare-professionals",
      async ({ query, getScope, getUserId }: any) => {
        const [scope, userId] = await Promise.all([getScope(), getUserId()]);
        return useCases.listPersonBookmarks().execute({
          userId,
          scope,
          page: query.page ?? 1,
          limit: query.limit ?? 20,
        });
      },
      {
        query: t.Object({
          page: t.Optional(t.Number({ minimum: 1 })),
          limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
        }),
        detail: {
          summary: "List the caller's favourited doctors, newest first",
          tags: ["Healthcare Professionals"],
          security: [{ bearerAuth: [] }],
        },
      }
    );

export function createHealthcareProfessionalsRoutes(
  useCases: HealthcareProfessionalsHttpUseCases = personUseCases,
  authPlugin: any = auth
) {
  return new Elysia()
    .use(listHealthcareSpecialtiesRoute(useCases, authPlugin))
    .use(listHealthcareProfessionalsRoute(useCases, authPlugin))
    .use(addPersonBookmarkRoute(useCases, authPlugin))
    .use(removePersonBookmarkRoute(useCases, authPlugin))
    .use(listPersonBookmarksRoute(useCases, authPlugin));
}

export const healthcareProfessionalsRoute = createHealthcareProfessionalsRoutes();
