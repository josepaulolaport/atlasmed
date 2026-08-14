import { describe, expect, it, mock } from "bun:test";
import {
  createGlobalScopeContext,
  ForbiddenError,
  type Role,
} from "@atlasmed/access";
import { Elysia } from "elysia";
import { UnauthorizedError } from "../../shared/errors";
import {
  authRequest,
  createHttpIntegrationApp,
} from "../../test-utils/http-integration-test";
import {
  createFacilityBookmarksRoutes,
  type FacilityBookmarksHttpUseCases,
} from "./infrastructure/routes/facility-bookmarks.route";

function actorPlugin(roleName: Role = "REP", userId = 1) {
  return new Elysia().derive({ as: "scoped" }, () => ({
    getUserId: async () => userId,
    getScope: async () => createGlobalScopeContext(),
    getAuthContext: async () => ({ userId, sessionId: "session", roleName }),
    getUser: async () => ({ id: userId, role: { name: roleName } }),
  }));
}

function unauthenticatedPlugin() {
  return new Elysia().derive({ as: "scoped" }, () => {
    throw new UnauthorizedError();
  });
}

function bookmarkUseCases(
  overrides: Partial<FacilityBookmarksHttpUseCases> = {}
): FacilityBookmarksHttpUseCases {
  return {
    addFacilityBookmark: () => ({
      execute: mock(async () => ({ bookmarked: true })),
    }),
    removeFacilityBookmark: () => ({
      execute: mock(async () => ({ bookmarked: false })),
    }),
    listFacilityBookmarks: () => ({
      execute: mock(async () => ({
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
      })),
    }),
    ...overrides,
  };
}

function app(
  useCases: FacilityBookmarksHttpUseCases = bookmarkUseCases(),
  role: Role | "unauthenticated" = "REP"
) {
  const authPlugin =
    role === "unauthenticated" ? unauthenticatedPlugin() : actorPlugin(role);
  return createHttpIntegrationApp(
    createFacilityBookmarksRoutes(useCases, authPlugin)
  );
}

describe("Facility bookmark HTTP routes", () => {
  it("saves a clinic and echoes the new state", async () => {
    const add = mock(async () => ({ bookmarked: true }));
    const response = await authRequest(
      app(bookmarkUseCases({ addFacilityBookmark: () => ({ execute: add }) })),
      "http://localhost/api/v1/facilities/7/bookmark",
      "token",
      { method: "PUT" }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ bookmarked: true });
    /**
     * `userId` and `scope` come from the session, never the request. If either
     * were ever accepted from the body, one rep could write into another rep's
     * list — the failure would be silent and look like a UI bug.
     */
    expect(add).toHaveBeenCalledWith(
      expect.objectContaining({ facilityId: 7, userId: 1 })
    );
  });

  it("removes a clinic and echoes the new state", async () => {
    const remove = mock(async () => ({ bookmarked: false }));
    const response = await authRequest(
      app(
        bookmarkUseCases({ removeFacilityBookmark: () => ({ execute: remove }) })
      ),
      "http://localhost/api/v1/facilities/7/bookmark",
      "token",
      { method: "DELETE" }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ bookmarked: false });
  });

  it("lists with defaults applied when no paging is given", async () => {
    const list = mock(async () => ({
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
    }));
    const response = await authRequest(
      app(bookmarkUseCases({ listFacilityBookmarks: () => ({ execute: list }) })),
      "http://localhost/api/v1/me/bookmarks/facilities",
      "token"
    );

    expect(response.status).toBe(200);
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 1, page: 1, limit: 20 })
    );
  });

  it("returns 403 when the use case rejects an out-of-scope clinic", async () => {
    // The clinic exists; this caller cannot see it. Route-level CASL is
    // role-wide, so the row-level refusal has to survive to the response.
    const denied = {
      execute: mock(async () => {
        throw new ForbiddenError("Resource outside scope: facility");
      }),
    };
    const response = await authRequest(
      app(bookmarkUseCases({ addFacilityBookmark: () => denied })),
      "http://localhost/api/v1/facilities/999/bookmark",
      "token",
      { method: "PUT" }
    );

    expect(response.status).toBe(403);
  });

  it.each([
    ["/api/v1/facilities/7/bookmark", "PUT"],
    ["/api/v1/facilities/7/bookmark", "DELETE"],
    ["/api/v1/me/bookmarks/facilities", "GET"],
  ])("returns 401 without auth on %s %s", async (path, method) => {
    const response = await authRequest(
      app(undefined, "unauthenticated"),
      `http://localhost${path}`,
      "token",
      { method }
    );
    expect(response.status).toBe(401);
  });

  it("rejects a non-positive facility id before reaching the use case", async () => {
    const add = mock(async () => ({ bookmarked: true }));
    const response = await authRequest(
      app(bookmarkUseCases({ addFacilityBookmark: () => ({ execute: add }) })),
      "http://localhost/api/v1/facilities/0/bookmark",
      "token",
      { method: "PUT" }
    );

    expect(response.status).toBe(400);
    expect(add).not.toHaveBeenCalled();
  });

  it("rejects an oversized page limit", async () => {
    const list = mock(async () => ({
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
    }));
    // The cap exists so one caller cannot ask for the whole table in a request.
    const response = await authRequest(
      app(bookmarkUseCases({ listFacilityBookmarks: () => ({ execute: list }) })),
      "http://localhost/api/v1/me/bookmarks/facilities?limit=5000",
      "token"
    );

    expect(response.status).toBe(400);
    expect(list).not.toHaveBeenCalled();
  });
});
