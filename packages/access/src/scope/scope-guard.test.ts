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
      assertScopedFacility(createGlobalScopeContext(), 1)
    ).not.toThrow();
  });

  it("assertScopedFacility denies out-of-scope facility", () => {
    const scope = {
      ...createEmptyScopeContext(),
      facilityIds: [1],
      isOperationallyActive: true,
    };

    expect(() => assertScopedFacility(scope, 2)).toThrow(ForbiddenError);
  });

  it("assertScopedTerritory denies out-of-scope territory", () => {
    const scope = {
      ...createEmptyScopeContext(),
      effectiveTerritoryIds: [1],
      isOperationallyActive: true,
    };

    expect(() => assertScopedTerritory(scope, 2)).toThrow(ForbiddenError);
  });

  it("assertScopedUser denies out-of-scope user", () => {
    const scope = {
      ...createEmptyScopeContext(),
      managedUserIds: [1],
      isOperationallyActive: true,
    };

    expect(() => assertScopedUser(scope, 2)).toThrow(ForbiddenError);
  });
});
