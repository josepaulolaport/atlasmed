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
    .get("/users/:id/assignments", async ({ params, getUser }: any) => {
      await assertRoutePermission(getUser, "manage", "USER");
      const actor = await getUser();
      return routeTestContext.mocks.getUserAssignmentsExecute({
        targetUserId: params.id,
        actorRole: actor.role.name,
      });
    })
    .patch(
      "/users/:id/manager",
      async ({ params, body, getUserId, getUser }: any) => {
        await assertRoutePermission(getUser, "manage", "USER");
        const assignedBy = await getUserId();
        const actorUser = await getUser();

        await routeTestContext.mocks.assignUserManagerExecute({
          targetUserId: params.id,
          managerId: body.managerId,
          assignedBy,
          actorRole: actorUser.role.name,
        });

        return {
          message: body.managerId
            ? "User manager assigned successfully"
            : "User manager removed successfully",
        };
      },
      {
        body: t.Object({
          managerId: t.Union([t.String(), t.Null()]),
        }),
      }
    )
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
      }
    )
    .delete("/users/:id/territories/:territoryId", async ({ params, getUserId, getUser }: any) => {
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
    });
}

describe("userAssignmentsRoute", () => {
  const targetUserId = "target-user-123";

  beforeEach(() => {
    setRouteTestActor(adminRouteTestUser);
    routeTestContext.mocks.getUserAssignmentsExecute.mockReset();
    routeTestContext.mocks.getUserAssignmentsExecute.mockImplementation(() =>
      Promise.resolve({
        userId: targetUserId,
        managerId: null,
        manager: null,
        territories: [],
        isOperationallyActive: false,
      })
    );
    routeTestContext.mocks.assignUserManagerExecute.mockReset();
    routeTestContext.mocks.assignUserManagerExecute.mockImplementation(() =>
      Promise.resolve()
    );
    routeTestContext.mocks.assignUserTerritoryExecute.mockReset();
    routeTestContext.mocks.assignUserTerritoryExecute.mockImplementation(() =>
      Promise.resolve()
    );
    routeTestContext.mocks.revokeUserTerritoryExecute.mockReset();
    routeTestContext.mocks.revokeUserTerritoryExecute.mockImplementation(() =>
      Promise.resolve()
    );
  });

  function createApp(actor = routeTestContext.user) {
    return createAccessTestApp().use(buildUserAssignmentsTestRoute(actor));
  }

  describe("GET /users/:id/assignments", () => {
    it("returns assignments for ADMIN", async () => {
      const app = createApp();
      const response = await app.handle(
        new Request(`http://localhost/users/${targetUserId}/assignments`)
      );

      expect(response.status).toBe(200);
      const body = await parseJsonResponse<{ userId: string }>(response);
      expect(body.userId).toBe(targetUserId);
      expect(routeTestContext.mocks.getUserAssignmentsExecute).toHaveBeenCalledWith({
        targetUserId,
        actorRole: "ADMIN",
      });
    });

    it("returns 403 for MANAGER", async () => {
      setRouteTestActor(managerRouteTestUser);
      const app = createApp(managerRouteTestUser);
      const response = await app.handle(
        new Request(`http://localhost/users/${targetUserId}/assignments`)
      );

      expect(response.status).toBe(403);
      expect(routeTestContext.mocks.getUserAssignmentsExecute).not.toHaveBeenCalled();
    });
  });

  describe("PATCH /users/:id/manager", () => {
    it("assigns manager for ADMIN", async () => {
      const app = createApp();
      const response = await app.handle(
        new Request(`http://localhost/users/${targetUserId}/manager`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ managerId: "manager-1" }),
        })
      );

      expect(response.status).toBe(200);
      expect(routeTestContext.mocks.assignUserManagerExecute).toHaveBeenCalledWith({
        targetUserId,
        managerId: "manager-1",
        assignedBy: adminRouteTestUser.id,
        actorRole: "ADMIN",
      });
    });

    it("returns 403 for MANAGER", async () => {
      setRouteTestActor(managerRouteTestUser);
      const app = createApp(managerRouteTestUser);
      const response = await app.handle(
        new Request(`http://localhost/users/${targetUserId}/manager`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ managerId: "manager-1" }),
        })
      );

      expect(response.status).toBe(403);
      expect(routeTestContext.mocks.assignUserManagerExecute).not.toHaveBeenCalled();
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
        })
      );

      expect(response.status).toBe(200);
      expect(routeTestContext.mocks.assignUserTerritoryExecute).toHaveBeenCalled();
    });

    it("returns 403 for MANAGER", async () => {
      setRouteTestActor(managerRouteTestUser);
      const app = createApp(managerRouteTestUser);
      const response = await app.handle(
        new Request(`http://localhost/users/${targetUserId}/territories`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ territoryId: "territory-a" }),
        })
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
          { method: "DELETE" }
        )
      );

      expect(response.status).toBe(200);
      expect(routeTestContext.mocks.revokeUserTerritoryExecute).toHaveBeenCalledWith({
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
          { method: "DELETE" }
        )
      );

      expect(response.status).toBe(403);
    });
  });
});
