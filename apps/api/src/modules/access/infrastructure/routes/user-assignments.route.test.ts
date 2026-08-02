import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Elysia, t } from "elysia";
import {
  adminRouteTestUser,
  assertRoutePermission,
  createRouteTestAuthPlugin,
  managerRouteTestUser,
  routeTestContext,
  setRouteTestActor,
  type RouteTestUser,
} from "../../test-helpers/route-test-context";
import {
  createAccessTestApp,
  parseJsonResponse,
} from "../../test-helpers/access-test-app";

function buildUserAssignmentsTestRoute(actor: RouteTestUser) {
  return new Elysia()
    .use(createRouteTestAuthPlugin(actor))
    .get("/user/assignments", async ({ getUserId, getUser }: any) => {
      const userId = await getUserId();
      const actor = await getUser();
      return routeTestContext.mocks.getUserAssignmentsExecute({
        targetUserId: userId,
        actorRole: actor.role.name,
        self: true,
      });
    })
    .post(
      "/users/:id/territories",
      async ({ params, body, getUserId, getUser }: any) => {
        await assertRoutePermission(getUser, "manage", "USER");
        const assignedBy = await getUserId();
        const actorUser = await getUser();

        await routeTestContext.mocks.assignUserTerritoryExecute({
          targetUserId: params.id,
          territoryId: body.territoryId,
          assignedBy,
          actorRole: actorUser.role.name,
        });

        return { message: "User territory assigned successfully" };
      },
      {
        body: t.Object({
          territoryId: t.String(),
        }),
      },
    )
    .delete(
      "/users/:id/territories/:territoryId",
      async ({ params, getUserId, getUser }: any) => {
        await assertRoutePermission(getUser, "manage", "USER");
        const revokedBy = await getUserId();
        const actorUser = await getUser();

        await routeTestContext.mocks.revokeUserTerritoryExecute({
          targetUserId: params.id,
          territoryId: params.territoryId,
          revokedBy,
          actorRole: actorUser.role.name,
        });

        return { message: "User territory revoked successfully" };
      },
    );
}

describe("userAssignmentsRoute", () => {
  const targetUserId = "target-user-123";

  beforeEach(() => {
    setRouteTestActor(adminRouteTestUser);
    routeTestContext.mocks.getUserAssignmentsExecute.mockReset();
    routeTestContext.mocks.getUserAssignmentsExecute.mockImplementation(() =>
      Promise.resolve({
        userId: targetUserId,
        isOperationallyActive: false,
        verticalAssignments: [],
      }),
    );
    routeTestContext.mocks.assignUserTerritoryExecute.mockReset();
    routeTestContext.mocks.assignUserTerritoryExecute.mockImplementation(() =>
      Promise.resolve(),
    );
    routeTestContext.mocks.revokeUserTerritoryExecute.mockReset();
    routeTestContext.mocks.revokeUserTerritoryExecute.mockImplementation(() =>
      Promise.resolve(),
    );
  });

  function createApp(actor = routeTestContext.user) {
    return createAccessTestApp().use(buildUserAssignmentsTestRoute(actor));
  }

  describe("GET /user/assignments", () => {
    it("returns authenticated user assignments for ADMIN", async () => {
      const app = createApp();
      const response = await app.handle(
        new Request("http://localhost/user/assignments"),
      );

      expect(response.status).toBe(200);
      const body = await parseJsonResponse<{ userId: string }>(response);
      expect(body.userId).toBe(targetUserId);
      expect(
        routeTestContext.mocks.getUserAssignmentsExecute,
      ).toHaveBeenCalledWith({
        targetUserId: adminRouteTestUser.id,
        actorRole: "ADMIN",
        self: true,
      });
    });

    it("returns authenticated user assignments for MANAGER without manage USER permission", async () => {
      setRouteTestActor(managerRouteTestUser);
      const app = createApp(managerRouteTestUser);
      const response = await app.handle(
        new Request("http://localhost/user/assignments"),
      );

      expect(response.status).toBe(200);
      expect(
        routeTestContext.mocks.getUserAssignmentsExecute,
      ).toHaveBeenCalledWith({
        targetUserId: managerRouteTestUser.id,
        actorRole: "MANAGER",
        self: true,
      });
    });
  });

  describe("POST /users/:id/territories", () => {
    it("assigns territory for ADMIN", async () => {
      const app = createApp();
      const response = await app.handle(
        new Request(`http://localhost/users/${targetUserId}/territories`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ territoryId: "territory-a" }),
        }),
      );

      expect(response.status).toBe(200);
      expect(
        routeTestContext.mocks.assignUserTerritoryExecute,
      ).toHaveBeenCalled();
    });

    it("returns 403 for MANAGER", async () => {
      setRouteTestActor(managerRouteTestUser);
      const app = createApp(managerRouteTestUser);
      const response = await app.handle(
        new Request(`http://localhost/users/${targetUserId}/territories`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ territoryId: "territory-a" }),
        }),
      );

      expect(response.status).toBe(403);
    });
  });

  describe("DELETE /users/:id/territories/:territoryId", () => {
    it("revokes territory for ADMIN", async () => {
      const app = createApp();
      const response = await app.handle(
        new Request(
          `http://localhost/users/${targetUserId}/territories/territory-a`,
          { method: "DELETE" },
        ),
      );

      expect(response.status).toBe(200);
      expect(
        routeTestContext.mocks.revokeUserTerritoryExecute,
      ).toHaveBeenCalledWith({
        targetUserId,
        territoryId: "territory-a",
        revokedBy: adminRouteTestUser.id,
        actorRole: "ADMIN",
      });
    });

    it("returns 403 for MANAGER", async () => {
      setRouteTestActor(managerRouteTestUser);
      const app = createApp(managerRouteTestUser);
      const response = await app.handle(
        new Request(
          `http://localhost/users/${targetUserId}/territories/territory-a`,
          { method: "DELETE" },
        ),
      );

      expect(response.status).toBe(403);
    });
  });
});
