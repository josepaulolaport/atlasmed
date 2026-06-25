import { describe, expect, it } from "bun:test";
import { TerritoryHierarchyValidator } from "./territory-hierarchy-validator.service";
import { OperationNotAllowedError } from "../../../../shared/errors";

const countryType = {
  id: "tt_country",
  slug: "country",
  name: "Country",
  description: null,
  canHaveBoundary: true,
  assignsClinics: false,
  assignableToUsers: false,
  assignableToManagers: false,
  isCountryLevel: true,
  blockSiblingOverlap: false,
  sortOrder: 10,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const regionType = {
  ...countryType,
  id: "tt_region",
  slug: "region",
  name: "Region",
  isCountryLevel: false,
  assignableToManagers: true,
};

describe("TerritoryHierarchyValidator", () => {
  const validator = new TerritoryHierarchyValidator();

  it("allows country-level territory without parent", () => {
    expect(() =>
      validator.validateCreate({
        type: countryType,
        slug: "brazil",
        countryCode: "BR",
        parent: null,
        hasActiveCountryForCode: false,
      })
    ).not.toThrow();
  });

  it("allows typed territory with optional parent before geo linking", () => {
    expect(() =>
      validator.validateCreate({
        type: regionType,
        slug: "sudeste",
        countryCode: "BR",
        parent: null,
        hasActiveCountryForCode: true,
      })
    ).not.toThrow();
  });

  it("rejects duplicate country for same country code", () => {
    expect(() =>
      validator.validateCreate({
        type: countryType,
        slug: "brazil",
        countryCode: "BR",
        parent: null,
        hasActiveCountryForCode: true,
      })
    ).toThrow(OperationNotAllowedError);
  });
});
