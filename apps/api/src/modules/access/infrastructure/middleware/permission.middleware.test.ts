import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { defineAbilitiesFor } from "@atlasmed/access";
import type { Action, Subject } from "@atlasmed/access";
import { AppError, ForbiddenError } from "../../../../shared/errors";
import { requirePermission } from "./permission.middleware";

describe("PermissionMiddleware", () => {
  const mockAdminUser = {
    id: "admin-123",
    email: "admin@example.com",
    username: "admin",
    role: {
      id: "role-admin",
      name: "ADMIN" as const,
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  const mockManagerUser = {
    id: "manager-123",
    email: "manager@example.com",
    username: "manager",
    role: {
      id: "role-manager",
      name: "MANAGER" as const,
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  const mockRegularUser = {
    id: "user-123",
    email: "user@example.com",
    username: "user",
    role: {
      id: "role-user",
      name: "USER" as const,
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

    it("should allow ADMIN to manage CLINIC", () => {
      const ability = defineAbilitiesFor("ADMIN");

      expect(ability.can("manage", "CLINIC")).toBe(true);
    });

    it("should allow ADMIN to manage VISIT", () => {
      const ability = defineAbilitiesFor("ADMIN");

      expect(ability.can("manage", "VISIT")).toBe(true);
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

      expect(ability.can("read", "CLINIC")).toBe(true);
      expect(ability.can("manage", "CLINIC")).toBe(false);
    });

    it("should allow MANAGER to read VISIT", () => {
      const ability = defineAbilitiesFor("MANAGER");

      expect(ability.can("read", "VISIT")).toBe(true);
      expect(ability.can("manage", "VISIT")).toBe(false);
    });

    it("should allow MANAGER to read TERRITORY", () => {
      const ability = defineAbilitiesFor("MANAGER");

      expect(ability.can("read", "TERRITORY")).toBe(true);
    });

    it("should allow USER to read CLINIC", () => {
      const ability = defineAbilitiesFor("USER");

      expect(ability.can("read", "CLINIC")).toBe(true);
    });

    it("should allow USER to read VISIT", () => {
      const ability = defineAbilitiesFor("USER");

      expect(ability.can("read", "VISIT")).toBe(true);
    });
  });

  describe("missing permission", () => {
    it("should deny USER from creating USER", () => {
      const ability = defineAbilitiesFor("USER");

      expect(ability.can("create", "USER")).toBe(false);
    });

    it("should deny USER from updating USER", () => {
      const ability = defineAbilitiesFor("USER");

      expect(ability.can("update", "USER")).toBe(false);
    });

    it("should deny USER from deleting USER", () => {
      const ability = defineAbilitiesFor("USER");

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

    it("should deny USER from managing CLINIC", () => {
      const ability = defineAbilitiesFor("USER");

      expect(ability.can("manage", "CLINIC")).toBe(false);
    });

    it("should deny USER from managing VISIT", () => {
      const ability = defineAbilitiesFor("USER");

      expect(ability.can("manage", "VISIT")).toBe(false);
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
      expect(ability.can("read", "CLINIC")).toBe(true);
      expect(ability.can("read", "VISIT")).toBe(true);
      expect(ability.can("update", "CLINIC")).toBe(false);
    });

    it("should check multiple denied permissions for USER", () => {
      const ability = defineAbilitiesFor("USER");

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

      expect(ability.can("create", "CLINIC")).toBe(true);
      expect(ability.can("read", "CLINIC")).toBe(true);
      expect(ability.can("update", "CLINIC")).toBe(true);
      expect(ability.can("delete", "CLINIC")).toBe(true);
    });

    it("should have full CRUD on VISIT", () => {
      const ability = defineAbilitiesFor("ADMIN");

      expect(ability.can("create", "VISIT")).toBe(true);
      expect(ability.can("read", "VISIT")).toBe(true);
      expect(ability.can("update", "VISIT")).toBe(true);
      expect(ability.can("delete", "VISIT")).toBe(true);
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

    it("should have read-only on CLINIC", () => {
      const ability = defineAbilitiesFor("MANAGER");

      expect(ability.can("read", "CLINIC")).toBe(true);
      expect(ability.can("create", "CLINIC")).toBe(false);
      expect(ability.can("update", "CLINIC")).toBe(false);
      expect(ability.can("delete", "CLINIC")).toBe(false);
    });

    it("should have read-only on VISIT", () => {
      const ability = defineAbilitiesFor("MANAGER");

      expect(ability.can("read", "VISIT")).toBe(true);
      expect(ability.can("create", "VISIT")).toBe(false);
      expect(ability.can("update", "VISIT")).toBe(false);
      expect(ability.can("delete", "VISIT")).toBe(false);
    });

    it("should have read-only on TERRITORY", () => {
      const ability = defineAbilitiesFor("MANAGER");

      expect(ability.can("read", "TERRITORY")).toBe(true);
      expect(ability.can("create", "TERRITORY")).toBe(false);
      expect(ability.can("update", "TERRITORY")).toBe(false);
      expect(ability.can("delete", "TERRITORY")).toBe(false);
    });
  });

  describe("USER permissions", () => {
    it("should have read-only on CLINIC", () => {
      const ability = defineAbilitiesFor("USER");

      expect(ability.can("read", "CLINIC")).toBe(true);
      expect(ability.can("create", "CLINIC")).toBe(false);
      expect(ability.can("update", "CLINIC")).toBe(false);
      expect(ability.can("delete", "CLINIC")).toBe(false);
    });

    it("should have read-only on VISIT", () => {
      const ability = defineAbilitiesFor("USER");

      expect(ability.can("read", "VISIT")).toBe(true);
      expect(ability.can("create", "VISIT")).toBe(false);
      expect(ability.can("update", "VISIT")).toBe(false);
      expect(ability.can("delete", "VISIT")).toBe(false);
    });

    it("should have no permissions on USER", () => {
      const ability = defineAbilitiesFor("USER");

      expect(ability.can("create", "USER")).toBe(false);
      expect(ability.can("read", "USER")).toBe(false);
      expect(ability.can("update", "USER")).toBe(false);
      expect(ability.can("delete", "USER")).toBe(false);
    });

    it("should have no permissions on TERRITORY", () => {
      const ability = defineAbilitiesFor("USER");

      expect(ability.can("create", "TERRITORY")).toBe(false);
      expect(ability.can("read", "TERRITORY")).toBe(false);
      expect(ability.can("update", "TERRITORY")).toBe(false);
      expect(ability.can("delete", "TERRITORY")).toBe(false);
    });
  });

  describe("Elysia scoped hook wiring", () => {
    function createTestApp(role: "ADMIN" | "MANAGER" | "USER") {
      const auth = new Elysia({ name: "auth-test" }).derive({ as: "scoped" }, async () => ({
        getUser: async () => ({
          id: "user-test",
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

    it("blocks USER on manage USER routes", async () => {
      const app = createTestApp("USER");
      const response = await app.handle(new Request("http://localhost/protected"));

      expect(response.status).toBe(403);
    });
  });
});
