import { Elysia, t } from "elysia";
import { auth } from "../../../access/composition";
import { requirePermission } from "../../../access/infrastructure/middleware/permission.middleware";
import { facilityUseCases } from "../../composition";

type Executable = { execute(input?: any): Promise<any> };

/**
 * Injectable so the routes can be integration-tested with fake use cases.
 *
 * `facilities.route.ts` is not — it binds the composition root directly, which
 * is why nothing in that 900-line file has an integration test. Rather than
 * inherit that, Favoritos lives in its own file with the factory shape the
 * person module already uses.
 */
export interface FacilityBookmarksHttpUseCases {
  addFacilityBookmark(): Executable;
  removeFacilityBookmark(): Executable;
  listFacilityBookmarks(): Executable;
}

/**
 * Favoritos — a rep's private shortlist.
 *
 * Gated on `read`, not `update`: saving a clinic changes nothing about the
 * clinic, only the caller's own row. The rule is "you may save what you may
 * see", which cannot drift out of step with clinic visibility the way a
 * separate permission would.
 */
const addFacilityBookmarkRoute = (
  useCases: FacilityBookmarksHttpUseCases,
  authPlugin: any = auth
) =>
  new Elysia()
    .use(authPlugin)
    .use(requirePermission("read", "FACILITY", { resourceIdParam: "id" }))
    .put(
      "/facilities/:id/bookmark",
      async ({ params, getScope, getUserId }: any) => {
        const [scope, userId] = await Promise.all([getScope(), getUserId()]);
        return useCases
          .addFacilityBookmark()
          .execute({ facilityId: params.id, userId, scope });
      },
      {
        params: t.Object({ id: t.Number({ minimum: 1 }) }),
        detail: {
          summary: "Save a clinic to the caller's favourites",
          tags: ["Clinics"],
          security: [{ bearerAuth: [] }],
        },
      }
    );

const removeFacilityBookmarkRoute = (
  useCases: FacilityBookmarksHttpUseCases,
  authPlugin: any = auth
) =>
  new Elysia()
    .use(authPlugin)
    .use(requirePermission("read", "FACILITY", { resourceIdParam: "id" }))
    .delete(
      "/facilities/:id/bookmark",
      async ({ params, getScope, getUserId }: any) => {
        const [scope, userId] = await Promise.all([getScope(), getUserId()]);
        return useCases
          .removeFacilityBookmark()
          .execute({ facilityId: params.id, userId, scope });
      },
      {
        params: t.Object({ id: t.Number({ minimum: 1 }) }),
        detail: {
          summary: "Remove a clinic from the caller's favourites",
          tags: ["Clinics"],
          security: [{ bearerAuth: [] }],
        },
      }
    );

/**
 * Under `/me/` rather than `/facilities/bookmarks`, which would be captured by
 * `/facilities/:id` — the same trap the `clinical-focuses` ordering comment in
 * `facilities.route.ts` works around. `/me/` also says plainly that the list is
 * per-caller.
 */
const listFacilityBookmarksRoute = (
  useCases: FacilityBookmarksHttpUseCases,
  authPlugin: any = auth
) =>
  new Elysia()
    .use(authPlugin)
    .use(requirePermission("read", "FACILITY"))
    .get(
      "/me/bookmarks/facilities",
      async ({ query, getScope, getUserId }: any) => {
        const [scope, userId] = await Promise.all([getScope(), getUserId()]);
        return useCases.listFacilityBookmarks().execute({
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
          summary: "List the caller's favourited clinics, newest first",
          tags: ["Clinics"],
          security: [{ bearerAuth: [] }],
        },
      }
    );

export function createFacilityBookmarksRoutes(
  useCases: FacilityBookmarksHttpUseCases = facilityUseCases,
  authPlugin: any = auth
) {
  return new Elysia()
    .use(addFacilityBookmarkRoute(useCases, authPlugin))
    .use(removeFacilityBookmarkRoute(useCases, authPlugin))
    .use(listFacilityBookmarksRoute(useCases, authPlugin));
}

export const facilityBookmarksRoute = createFacilityBookmarksRoutes();
