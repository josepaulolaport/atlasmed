import { describe, expect, it } from "bun:test";
import { Role } from "../enums/role.enum";
import {
  canManageUsers,
  canReadCatalog,
  canManageCatalog,
  canReadTerritories,
  canManageTerritories,
  canViewHealth,
  hasMinimumRole,
} from "./ui.permissions";

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

  describe("canReadTerritories", () => {
    it("should allow ADMIN and MANAGER", () => {
      expect(canReadTerritories(Role.ADMIN)).toBe(true);
      expect(canReadTerritories(Role.MANAGER)).toBe(true);
    });

    it("should deny USER", () => {
      expect(canReadTerritories(Role.USER)).toBe(false);
    });
  });

  describe("canManageTerritories", () => {
    it("should allow ADMIN only", () => {
      expect(canManageTerritories(Role.ADMIN)).toBe(true);
      expect(canManageTerritories(Role.MANAGER)).toBe(false);
    });
  });

  describe("catalog permissions", () => {
    it("should allow ADMIN to read and manage catalog", () => {
      expect(canReadCatalog(Role.ADMIN)).toBe(true);
      expect(canManageCatalog(Role.ADMIN)).toBe(true);
    });

    it("should deny MANAGER and USER catalog access", () => {
      expect(canReadCatalog(Role.MANAGER)).toBe(false);
      expect(canManageCatalog(Role.MANAGER)).toBe(false);
      expect(canReadCatalog(Role.USER)).toBe(false);
      expect(canManageCatalog(Role.USER)).toBe(false);
    });
  });
});
