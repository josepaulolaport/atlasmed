import { describe, expect, it } from "bun:test";
import { createEmptyScopeContext, createGlobalScopeContext } from "./scope.helpers";
import {
  assertScopedFacility,
  assertScopedTerritory,
  assertScopedUser,
} from "./scope-guard";
import { ForbiddenError } from "../errors/forbidden.error";

describe("scope-guard", () => {
  it("assertScopedFacility allows global scope", () => {
    expect(() =>
      assertScopedFacility(createGlobalScopeContext(), "facility-1")
    ).not.toThrow();
  });

  it("assertScopedFacility denies out-of-scope facility", () => {
    const scope = {
      ...createEmptyScopeContext(),
      facilityIds: ["facility-1"],
      isOperationallyActive: true,
    };

    expect(() => assertScopedFacility(scope, "facility-2")).toThrow(ForbiddenError);
  });

  it("assertScopedTerritory denies out-of-scope territory", () => {
    const scope = {
      ...createEmptyScopeContext(),
      effectiveTerritoryIds: ["t-1"],
      isOperationallyActive: true,
    };

    expect(() => assertScopedTerritory(scope, "t-2")).toThrow(ForbiddenError);
  });

  it("assertScopedUser denies out-of-scope user", () => {
    const scope = {
      ...createEmptyScopeContext(),
      managedUserIds: ["user-1"],
      isOperationallyActive: true,
    };

    expect(() => assertScopedUser(scope, "user-2")).toThrow(ForbiddenError);
  });
});
