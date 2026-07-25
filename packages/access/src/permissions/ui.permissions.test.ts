import { describe, expect, it } from "bun:test";
import { Role } from "../enums/role.enum";
import {
  canManageUsers,
  canReadCatalog,
  canManageCatalog,
  canReadCadastroSubmissions,
  canReadFieldSuggestions,
  canReadTerritories,
  canManageTerritories,
  canViewHealth,
  hasMinimumRole,
} from "./ui.permissions";

describe("ui.permissions", () => {
  describe("hasMinimumRole", () => {
    it("should allow equal or higher roles", () => {
      expect(hasMinimumRole(Role.ADMIN, Role.REP)).toBe(true);
      expect(hasMinimumRole(Role.MANAGER, Role.MANAGER)).toBe(true);
    });

    it("should deny lower roles", () => {
      expect(hasMinimumRole(Role.REP, Role.MANAGER)).toBe(false);
    });
  });

  describe("canManageUsers", () => {
    it("should allow ADMIN and MANAGER", () => {
      expect(canManageUsers(Role.ADMIN)).toBe(true);
      expect(canManageUsers(Role.MANAGER)).toBe(true);
    });

    it("should deny USER", () => {
      expect(canManageUsers(Role.REP)).toBe(false);
    });
  });

  describe("canViewHealth", () => {
    it("should allow ADMIN only", () => {
      expect(canViewHealth(Role.ADMIN)).toBe(true);
      expect(canViewHealth(Role.MANAGER)).toBe(false);
      expect(canViewHealth(Role.REP)).toBe(false);
    });
  });

  describe("canReadTerritories", () => {
    it("should allow ADMIN and MANAGER", () => {
      expect(canReadTerritories(Role.ADMIN)).toBe(true);
      expect(canReadTerritories(Role.MANAGER)).toBe(true);
    });

    it("should deny USER", () => {
      expect(canReadTerritories(Role.REP)).toBe(false);
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

    it("should allow MANAGER and REP to read catalog", () => {
      expect(canReadCatalog(Role.MANAGER)).toBe(true);
      expect(canManageCatalog(Role.MANAGER)).toBe(false);
      expect(canReadCatalog(Role.REP)).toBe(true);
      expect(canManageCatalog(Role.REP)).toBe(false);
    });
  });

  describe("canReadFieldSuggestions", () => {
    it("should allow ADMIN, MANAGER, OPS and deny REP", () => {
      expect(canReadFieldSuggestions(Role.ADMIN)).toBe(true);
      expect(canReadFieldSuggestions(Role.MANAGER)).toBe(true);
      expect(canReadFieldSuggestions(Role.OPS)).toBe(true);
      expect(canReadFieldSuggestions(Role.REP)).toBe(false);
    });
  });

  describe("canReadCadastroSubmissions", () => {
    it("should allow ADMIN, MANAGER, OPS and deny REP", () => {
      expect(canReadCadastroSubmissions(Role.ADMIN)).toBe(true);
      expect(canReadCadastroSubmissions(Role.MANAGER)).toBe(true);
      expect(canReadCadastroSubmissions(Role.OPS)).toBe(true);
      expect(canReadCadastroSubmissions(Role.REP)).toBe(false);
    });
  });
});
