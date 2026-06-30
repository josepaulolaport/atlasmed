import { describe, expect, it } from "bun:test";
import { createEmptyScopeContext, createGlobalScopeContext } from "./scope.helpers";
import { assertResourceInScope } from "./scope-enforcement.helpers";
import { ForbiddenError } from "../errors/forbidden.error";

describe("assertResourceInScope", () => {
  it("allows global scope", () => {
    expect(() =>
      assertResourceInScope(createGlobalScopeContext(), "facility", "facility-1")
    ).not.toThrow();
  });

  it("denies facility outside scope", () => {
    const scope = {
      ...createEmptyScopeContext(),
      facilityIds: ["facility-1"],
      isOperationallyActive: true,
    };

    expect(() =>
      assertResourceInScope(scope, "facility", "facility-2")
    ).toThrow(ForbiddenError);
  });

  it("allows facility inside scope", () => {
    const scope = {
      ...createEmptyScopeContext(),
      facilityIds: ["facility-1"],
      isOperationallyActive: true,
    };

    expect(() =>
      assertResourceInScope(scope, "facility", "facility-1")
    ).not.toThrow();
  });
});
