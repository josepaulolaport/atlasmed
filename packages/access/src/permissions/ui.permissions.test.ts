import { describe, expect, it } from "bun:test";
import { Role } from "../enums/role.enum";
import { canManageUsers, canViewHealth, hasMinimumRole } from "./ui.permissions";

describe("ui.permissions", () => {
  describe("hasMinimumRole", () => {
    it("should allow equal or higher roles", () => {
      expect(hasMinimumRole(Role.ADMIN, Role.USER)).toBe(true);
      expect(hasMinimumRole(Role.MANAGER, Role.MANAGER)).toBe(true);
    });

    it("should deny lower roles", () => {
      expect(hasMinimumRole(Role.USER, Role.MANAGER)).toBe(false);
    });
  });

  describe("canManageUsers", () => {
    it("should allow ADMIN and MANAGER", () => {
      expect(canManageUsers(Role.ADMIN)).toBe(true);
      expect(canManageUsers(Role.MANAGER)).toBe(true);
    });

    it("should deny USER", () => {
      expect(canManageUsers(Role.USER)).toBe(false);
    });
  });

  describe("canViewHealth", () => {
    it("should allow ADMIN only", () => {
      expect(canViewHealth(Role.ADMIN)).toBe(true);
      expect(canViewHealth(Role.MANAGER)).toBe(false);
      expect(canViewHealth(Role.USER)).toBe(false);
    });
  });
});
