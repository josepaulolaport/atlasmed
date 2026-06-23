import { describe, expect, it } from "bun:test";
import { TerritoryHierarchyValidator } from "./territory-hierarchy-validator.service";
import { OperationNotAllowedError } from "../../../../shared/errors";

describe("TerritoryHierarchyValidator", () => {
  const validator = new TerritoryHierarchyValidator();

  it("allows region under root", () => {
    expect(() =>
      validator.validateCreate({
        nodeType: "region",
        parent: {
          id: "root",
          name: "Brazil",
          code: "BR",
          nodeType: "root",
          regionSlug: null,
          stateCode: null,
          parentId: null,
          isActive: true,
          organizationId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        regionSlug: "SE",
        stateCode: null,
        hasActiveRoot: true,
      })
    ).not.toThrow();
  });

  it("rejects second root", () => {
    expect(() =>
      validator.validateCreate({
        nodeType: "root",
        parent: null,
        regionSlug: null,
        stateCode: null,
        hasActiveRoot: true,
      })
    ).toThrow(OperationNotAllowedError);
  });
});
