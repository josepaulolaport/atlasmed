import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { defineAbilitiesFor } from "@atlasmed/access";
import type { Action, Subject } from "@atlasmed/access";
import { AppError, ForbiddenError } from "../../../../shared/errors";
import { requirePermission } from "./permission.middleware";

describe("PermissionMiddleware", () => {
  const mockAdminUser = {
    id: 1,
    email: "admin@example.com",
    username: "admin",
    role: {
      id: 1,
      name: "ADMIN" as const,
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  const mockManagerUser = {
    id: 2,
    email: "manager@example.com",
    username: "manager",
    role: {
      id: 2,
      name: "MANAGER" as const,
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  const mockRegularUser = {
    id: 123,
    email: "user@example.com",
    username: "user",
    role: {
      id: 3,
      name: "REP" as const,
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  describe("allowed permission", () => {
    it("should allow ADMIN to manage USER", () => {
      const ability = defineAbilitiesFor("ADMIN");

      expect(ability.can("manage", "USER")).toBe(true);
    });

    it("should allow ADMIN to manage search sync", () => {
      expect(defineAbilitiesFor("ADMIN").can("manage", "SEARCH_SYNC")).toBe(true);
      expect(defineAbilitiesFor("MANAGER").can("manage", "SEARCH_SYNC")).toBe(false);
    });

    it("should allow ADMIN to manage CLINIC", () => {
      const ability = defineAbilitiesFor("ADMIN");

      expect(ability.can("manage", "FACILITY")).toBe(true);
    });

    it("should allow ADMIN to manage TERRITORY", () => {
      const ability = defineAbilitiesFor("ADMIN");

      expect(ability.can("manage", "TERRITORY")).toBe(true);
    });

    it("should allow MANAGER to read USER", () => {
      const ability = defineAbilitiesFor("MANAGER");

      expect(ability.can("read", "USER")).toBe(true);
    });

    it("should allow MANAGER to read CLINIC", () => {
      const ability = defineAbilitiesFor("MANAGER");

      expect(ability.can("read", "FACILITY")).toBe(true);
      expect(ability.can("manage", "FACILITY")).toBe(false);
    });

    it("should allow MANAGER to read TERRITORY", () => {
      const ability = defineAbilitiesFor("MANAGER");

      expect(ability.can("read", "TERRITORY")).toBe(true);
    });

    it("should allow REP to read CLINIC", () => {
      const ability = defineAbilitiesFor("REP");

      expect(ability.can("read", "FACILITY")).toBe(true);
    });

  });

  describe("missing permission", () => {
    it("should deny REP from creating USER", () => {
      const ability = defineAbilitiesFor("REP");

      expect(ability.can("create", "USER")).toBe(false);
    });

    it("should deny REP from updating USER", () => {
      const ability = defineAbilitiesFor("REP");

      expect(ability.can("update", "USER")).toBe(false);
    });

    it("should deny REP from deleting USER", () => {
      const ability = defineAbilitiesFor("REP");

      expect(ability.can("delete", "USER")).toBe(false);
    });

    it("should deny MANAGER from managing USER", () => {
      const ability = defineAbilitiesFor("MANAGER");

      expect(ability.can("manage", "USER")).toBe(false);
    });

    it("should deny MANAGER from managing TERRITORY", () => {
      const ability = defineAbilitiesFor("MANAGER");

      expect(ability.can("manage", "TERRITORY")).toBe(false);
    });

    it("should deny REP from managing CLINIC", () => {
      const ability = defineAbilitiesFor("REP");

      expect(ability.can("manage", "FACILITY")).toBe(false);
    });
  });

  describe("multiple permission checks", () => {
    it("should check multiple permissions for ADMIN", () => {
      const ability = defineAbilitiesFor("ADMIN");

      expect(ability.can("create", "USER")).toBe(true);
      expect(ability.can("read", "USER")).toBe(true);
      expect(ability.can("update", "USER")).toBe(true);
      expect(ability.can("delete", "USER")).toBe(true);
    });

    it("should check multiple permissions for MANAGER", () => {
      const ability = defineAbilitiesFor("MANAGER");

      expect(ability.can("read", "USER")).toBe(true);
      expect(ability.can("create", "USER")).toBe(true);
      expect(ability.can("read", "FACILITY")).toBe(true);
      expect(ability.can("update", "FACILITY")).toBe(true);
      expect(ability.can("create", "TERRITORY")).toBe(true);
      expect(ability.can("update", "TERRITORY")).toBe(true);
      expect(ability.can("manage", "TERRITORY")).toBe(false);
    });

    it("should check multiple denied permissions for REP", () => {
      const ability = defineAbilitiesFor("REP");

      expect(ability.can("create", "USER")).toBe(false);
      expect(ability.can("update", "USER")).toBe(false);
      expect(ability.can("delete", "USER")).toBe(false);
      expect(ability.can("manage", "USER")).toBe(false);
    });
  });

  describe("error handling", () => {
    it("should throw ForbiddenError when permission denied", () => {
      const error = new ForbiddenError();

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe("Forbidden");
    });

    it("should throw ForbiddenError when auth context missing", () => {
      const auth = undefined;

      expect(auth).toBeUndefined();

      const error = new ForbiddenError();
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe("ADMIN permissions", () => {
    it("should have full CRUD on USER", () => {
      const ability = defineAbilitiesFor("ADMIN");

      expect(ability.can("create", "USER")).toBe(true);
      expect(ability.can("read", "USER")).toBe(true);
      expect(ability.can("update", "USER")).toBe(true);
      expect(ability.can("delete", "USER")).toBe(true);
    });

    it("should have full CRUD on CLINIC", () => {
      const ability = defineAbilitiesFor("ADMIN");

      expect(ability.can("create", "FACILITY")).toBe(true);
      expect(ability.can("read", "FACILITY")).toBe(true);
      expect(ability.can("update", "FACILITY")).toBe(true);
      expect(ability.can("delete", "FACILITY")).toBe(true);
    });

    it("should have full CRUD on TERRITORY", () => {
      const ability = defineAbilitiesFor("ADMIN");

      expect(ability.can("create", "TERRITORY")).toBe(true);
      expect(ability.can("read", "TERRITORY")).toBe(true);
      expect(ability.can("update", "TERRITORY")).toBe(true);
      expect(ability.can("delete", "TERRITORY")).toBe(true);
    });
  });

  describe("MANAGER permissions", () => {
    it("should have read, update, and create permissions on USER", () => {
      const ability = defineAbilitiesFor("MANAGER");

      expect(ability.can("read", "USER")).toBe(true);
      expect(ability.can("create", "USER")).toBe(true);
      expect(ability.can("update", "USER")).toBe(true);
      expect(ability.can("delete", "USER")).toBe(false);
    });

    it("should have read and update on CLINIC", () => {
      const ability = defineAbilitiesFor("MANAGER");

      expect(ability.can("read", "FACILITY")).toBe(true);
      expect(ability.can("create", "FACILITY")).toBe(false);
      expect(ability.can("update", "FACILITY")).toBe(true);
      expect(ability.can("delete", "FACILITY")).toBe(false);
    });

    it("should have read, create, and update on TERRITORY", () => {
      const ability = defineAbilitiesFor("MANAGER");

      expect(ability.can("read", "TERRITORY")).toBe(true);
      expect(ability.can("create", "TERRITORY")).toBe(true);
      expect(ability.can("update", "TERRITORY")).toBe(true);
      expect(ability.can("delete", "TERRITORY")).toBe(false);
      expect(ability.can("manage", "TERRITORY")).toBe(false);
    });
  });

  describe("REP permissions", () => {
    it("should have read and update on CLINIC", () => {
      const ability = defineAbilitiesFor("REP");

      expect(ability.can("read", "FACILITY")).toBe(true);
      expect(ability.can("create", "FACILITY")).toBe(false);
      expect(ability.can("update", "FACILITY")).toBe(true);
      expect(ability.can("delete", "FACILITY")).toBe(false);
    });

    it("should have no permissions on USER", () => {
      const ability = defineAbilitiesFor("REP");

      expect(ability.can("create", "USER")).toBe(false);
      expect(ability.can("read", "USER")).toBe(false);
      expect(ability.can("update", "USER")).toBe(false);
      expect(ability.can("delete", "USER")).toBe(false);
    });

    it("should have no permissions on TERRITORY", () => {
      const ability = defineAbilitiesFor("REP");

      expect(ability.can("create", "TERRITORY")).toBe(false);
      expect(ability.can("read", "TERRITORY")).toBe(false);
      expect(ability.can("update", "TERRITORY")).toBe(false);
      expect(ability.can("delete", "TERRITORY")).toBe(false);
    });

  });


  describe("Elysia scoped hook wiring", () => {
    function createTestApp(role: "ADMIN" | "MANAGER" | "REP") {
      const auth = new Elysia({ name: "auth-test" }).derive({ as: "scoped" }, async () => ({
        getUser: async () => ({
          id: 99,
          role: { name: role },
        }),
      }));

      return new Elysia()
        .onError(({ error, set }) => {
          if (error instanceof AppError) {
            set.status = error.statusCode;
            return { error: error.toClientJSON() };
          }
          throw error;
        })
        .use(auth)
        .use(requirePermission("manage", "USER"))
        .get("/protected", () => ({ ok: true }));
    }

    it("allows ADMIN on manage USER routes", async () => {
      const app = createTestApp("ADMIN");
      const response = await app.handle(new Request("http://localhost/protected"));

      expect(response.status).toBe(200);
    });

    it("blocks MANAGER on manage USER routes", async () => {
      const app = createTestApp("MANAGER");
      const response = await app.handle(new Request("http://localhost/protected"));

      expect(response.status).toBe(403);
    });

    it("blocks REP on manage USER routes", async () => {
      const app = createTestApp("REP");
      const response = await app.handle(new Request("http://localhost/protected"));

      expect(response.status).toBe(403);
    });
  });

  describe("a guard leaks onto every route declared after it", () => {
    /**
     * This is the behaviour, not the wish — and the reason route files must
     * declare one Elysia instance per permission.
     *
     * `onBeforeHandle({ as: "scoped" })` attaches to the *parent* chain, which
     * is what lets the guard read `getUser` from auth. The cost is that it also
     * runs for every route registered later in that chain, so
     *
     *   .use(requirePermission("read", X)).get(...)
     *   .use(requirePermission("delete", X)).delete(...)
     *   .use(requirePermission("read", X)).get(...)   // reads, but needs delete
     *
     * silently ANDs the guards together. Nothing in the middleware can prevent
     * that; `route-security.registry.test.ts` enforces the structure instead, by
     * rejecting a guard declared after a route in the same chain.
     */
    function chainedApp(role: "ADMIN" | "MANAGER") {
      const auth = new Elysia({ name: `auth-chain-${role}` }).derive(
        { as: "scoped" },
        async () => ({ getUser: async () => ({ id: 99, role: { name: role } }) })
      );

      return new Elysia()
        .onError(({ error, set }) => {
          if (error instanceof AppError) {
            set.status = error.statusCode;
            return { error: error.toClientJSON() };
          }
          throw error;
        })
        .use(auth)
        .use(requirePermission("read", "TERRITORY"))
        .get("/first-read", () => ({ ok: true }))
        .use(requirePermission("delete", "TERRITORY"))
        .delete("/destroy", () => ({ ok: true }))
        .use(requirePermission("read", "TERRITORY"))
        .get("/later-read", () => ({ ok: true }));
    }

    it("lets a MANAGER read before any stronger guard is declared", async () => {
      const response = await chainedApp("MANAGER").handle(
        new Request("http://localhost/first-read")
      );

      expect(response.status).toBe(200);
    });

    it("still refuses a MANAGER the delete it genuinely lacks", async () => {
      const response = await chainedApp("MANAGER").handle(
        new Request("http://localhost/destroy", { method: "DELETE" })
      );

      expect(response.status).toBe(403);
    });

    it("refuses a MANAGER a plain read that sits below a delete guard", async () => {
      // MANAGER has read TERRITORY and not delete TERRITORY, and this route only
      // ever claimed to need a read. It is refused anyway. Every 403 of this
      // shape is a permission the route never asked for.
      const response = await chainedApp("MANAGER").handle(
        new Request("http://localhost/later-read")
      );

      expect(response.status).toBe(403);
    });

    it("leaves ADMIN unaffected either way", async () => {
      const app = chainedApp("ADMIN");

      expect(
        (await app.handle(new Request("http://localhost/later-read"))).status
      ).toBe(200);
      expect(
        (
          await app.handle(
            new Request("http://localhost/destroy", { method: "DELETE" })
          )
        ).status
      ).toBe(200);
    });
  });
});
