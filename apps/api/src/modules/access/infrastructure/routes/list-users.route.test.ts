import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Elysia, t } from "elysia";
import { createGlobalScopeContext } from "@atlasmed/access";
import type { ScopeContext } from "@atlasmed/access";
import {
  adminRouteTestUser,
  assertRoutePermission,
  createRouteTestAuthPlugin,
  managerRouteTestUser,
  managerScopedContext,
  routeTestContext,
  setRouteTestActor,
  userRouteTestUser,
  type RouteTestUser,
} from "../../test-helpers/route-test-context";
import { createAccessTestApp } from "../../test-helpers/access-test-app";

function buildListUsersTestRoute(actor: RouteTestUser, scope: ScopeContext) {
  return new Elysia()
    .use(createRouteTestAuthPlugin(actor, scope))
    .get(
      "/users",
      async ({ query, getScope, getUser }: any) => {
        await assertRoutePermission(getUser, "read", "USER");
        const resolvedScope = await getScope();
        return routeTestContext.mocks.listUsersExecute({
          status: query.status,
          page: query.page ? Number(query.page) : undefined,
          limit: query.limit ? Number(query.limit) : undefined,
          search: query.search,
          scope: resolvedScope,
        });
      },
      {
        query: t.Object({
          status: t.Optional(
            t.Union([
              t.Literal("ACTIVE"),
              t.Literal("INACTIVE"),
              t.Literal("SUSPENDED"),
              t.Literal("PENDING"),
            ])
          ),
          page: t.Optional(t.String()),
          limit: t.Optional(t.String()),
          search: t.Optional(t.String()),
        }),
      }
    );
}

describe("listUsersRoute", () => {
  beforeEach(() => {
    setRouteTestActor(adminRouteTestUser);
    routeTestContext.mocks.listUsersExecute.mockReset();
    routeTestContext.mocks.listUsersExecute.mockImplementation(() =>
      Promise.resolve({
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
      })
    );
  });

  function createApp(actor = routeTestContext.user, scope = routeTestContext.scope) {
    return createAccessTestApp().use(buildListUsersTestRoute(actor, scope));
  }

  it("passes global scope for ADMIN", async () => {
    const adminScope = createGlobalScopeContext();
    setRouteTestActor(adminRouteTestUser, adminScope);
    const app = createApp(adminRouteTestUser, adminScope);
    const response = await app.handle(new Request("http://localhost/users"));

    expect(response.status).toBe(200);
    expect(routeTestContext.mocks.listUsersExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: expect.objectContaining({ isGlobal: true }),
      })
    );
  });

  it("passes manager territory scope for MANAGER", async () => {
    const managerScope = managerScopedContext(["territory-a"]);
    setRouteTestActor(managerRouteTestUser, managerScope);
    const app = createApp(managerRouteTestUser, managerScope);
    const response = await app.handle(new Request("http://localhost/users"));

    expect(response.status).toBe(200);
    expect(routeTestContext.mocks.listUsersExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: expect.objectContaining({
          isGlobal: false,
          territoryIds: ["territory-a"],
        }),
      })
    );
  });

  it("returns 403 for USER role", async () => {
    setRouteTestActor(userRouteTestUser);
    const app = createApp(userRouteTestUser);
    const response = await app.handle(new Request("http://localhost/users"));

    expect(response.status).toBe(403);
    expect(routeTestContext.mocks.listUsersExecute).not.toHaveBeenCalled();
  });

  it("forwards query params to listUsers use case", async () => {
    const app = createApp();
    await app.handle(
      new Request("http://localhost/users?page=2&limit=5&status=ACTIVE&search=alice")
    );

    expect(routeTestContext.mocks.listUsersExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 2,
        limit: 5,
        status: "ACTIVE",
        search: "alice",
      })
    );
  });
});
