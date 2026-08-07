import { describe, expect, it, mock } from "bun:test";
import { createGlobalScopeContext, type Role } from "@atlasmed/access";
import { Elysia } from "elysia";
import { UnauthorizedError } from "../../shared/errors";
import {
  authRequest,
  createHttpIntegrationApp,
} from "../../test-utils/http-integration-test";
import {
  createPersonProjectionsRoutes,
  type PersonProjectionsHttpUseCases,
} from "./infrastructure/routes/person-projections.route";

function actorPlugin(roleName: Role = "REP", userId = 1) {
  return new Elysia().derive({ as: "scoped" }, () => ({
    getUserId: async () => userId,
    getScope: async () => createGlobalScopeContext(),
    getAuthContext: async () => ({ userId, sessionId: "session", roleName }),
    getUser: async () => ({ id: userId, role: { name: roleName } }),
    getAccessGrants: async () => [],
  }));
}

function unauthenticatedPlugin() {
  return new Elysia().derive({ as: "scoped" }, () => {
    throw new UnauthorizedError();
  });
}

const projectionDto = {
  personFacilityId: 10,
  personId: 5,
  facilityId: 1,
  firstName: "Ana",
  lastName: "Silva",
  socialName: null,
  cpf: null,
  email: null,
  mobilePhone: null,
  landlinePhone: null,
  roleTitle: null,
  notes: null,
  hasHealthcareProfile: true,
  classificationCodes: ["HEALTHCARE_PROFESSIONAL"],
  roleCodes: ["PRESCRIBER", "BUYER"],
};

function projectionUseCases(
  overrides: Partial<PersonProjectionsHttpUseCases> = {}
): PersonProjectionsHttpUseCases {
  const projection = { execute: mock(async () => projectionDto) };
  const list = { execute: mock(async () => ({ data: [projectionDto] })) };
  const end = {
    execute: mock(async () => ({
      personFacilityId: 10,
      endedAt: "2026-08-07T12:00:00.000Z",
    })),
  };
  return {
    listFacilityProjections: () => list,
    getFacilityProjection: () => projection,
    upsertFacilityProjection: () => projection,
    patchFacilityProjection: () => projection,
    replaceFacilityProjectionRoles: () => projection,
    endFacilityAffiliation: () => end,
    ...overrides,
  };
}

function app(
  useCases: PersonProjectionsHttpUseCases = projectionUseCases(),
  role: Role | "unauthenticated" = "REP"
) {
  const authPlugin =
    role === "unauthenticated" ? unauthenticatedPlugin() : actorPlugin(role);

  return createHttpIntegrationApp(
    createPersonProjectionsRoutes(useCases, authPlugin)
  );
}

describe("Person projection HTTP routes", () => {
  it("returns 401 without auth on PUT healthcare roles", async () => {
    const response = await authRequest(
      app(undefined, "unauthenticated"),
      "http://localhost/api/v1/facilities/1/healthcare-professionals/10/roles",
      null,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roleCodes: ["PRESCRIBER"] }),
      }
    );
    expect(response.status).toBe(401);
  });

  it("PUT healthcare roles calls replace use-case and returns roleCodes", async () => {
    const replace = mock(async () => projectionDto);
    const application = app(
      projectionUseCases({
        replaceFacilityProjectionRoles: () => ({ execute: replace }),
      })
    );

    const response = await authRequest(
      application,
      "http://localhost/api/v1/facilities/1/healthcare-professionals/10/roles",
      "token",
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roleCodes: ["PRESCRIBER", "BUYER"] }),
      }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        personFacilityId: 10,
        roleCodes: ["PRESCRIBER", "BUYER"],
      })
    );
    expect(replace).toHaveBeenCalledWith(
      expect.objectContaining({
        facilityId: 1,
        personFacilityId: 10,
        classificationCode: "HEALTHCARE_PROFESSIONAL",
        roleCodes: ["PRESCRIBER", "BUYER"],
      })
    );
  });

  it("PUT administrative roles uses ADMINISTRATIVE_CONTACT classification", async () => {
    const replace = mock(async () => ({
      ...projectionDto,
      classificationCodes: ["ADMINISTRATIVE_CONTACT"],
      roleCodes: ["BILLER"],
    }));
    const application = app(
      projectionUseCases({
        replaceFacilityProjectionRoles: () => ({ execute: replace }),
      })
    );

    const response = await authRequest(
      application,
      "http://localhost/api/v1/facilities/1/administrative-contacts/10/roles",
      "token",
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roleCodes: ["BILLER"] }),
      }
    );

    expect(response.status).toBe(200);
    expect(replace).toHaveBeenCalledWith(
      expect.objectContaining({
        classificationCode: "ADMINISTRATIVE_CONTACT",
        roleCodes: ["BILLER"],
      })
    );
  });

  it("returns 401 without auth on DELETE healthcare affiliation", async () => {
    const response = await authRequest(
      app(undefined, "unauthenticated"),
      "http://localhost/api/v1/facilities/1/healthcare-professionals/10",
      null,
      { method: "DELETE" }
    );
    expect(response.status).toBe(401);
  });

  it("DELETE healthcare affiliation calls end use-case with actor user id", async () => {
    const end = mock(async () => ({
      personFacilityId: 10,
      endedAt: "2026-08-07T12:00:00.000Z",
    }));
    const application = app(
      projectionUseCases({
        endFacilityAffiliation: () => ({ execute: end }),
      })
    );

    const response = await authRequest(
      application,
      "http://localhost/api/v1/facilities/1/healthcare-professionals/10",
      "token",
      { method: "DELETE" }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      personFacilityId: 10,
      endedAt: "2026-08-07T12:00:00.000Z",
    });
    expect(end).toHaveBeenCalledWith(
      expect.objectContaining({
        facilityId: 1,
        personFacilityId: 10,
        classificationCode: "HEALTHCARE_PROFESSIONAL",
        endedByUserId: 1,
      })
    );
  });

  it("DELETE administrative affiliation uses ADMINISTRATIVE_CONTACT classification", async () => {
    const end = mock(async () => ({
      personFacilityId: 10,
      endedAt: "2026-08-07T12:00:00.000Z",
    }));
    const application = app(
      projectionUseCases({
        endFacilityAffiliation: () => ({ execute: end }),
      })
    );

    const response = await authRequest(
      application,
      "http://localhost/api/v1/facilities/1/administrative-contacts/10",
      "token",
      { method: "DELETE" }
    );

    expect(response.status).toBe(200);
    expect(end).toHaveBeenCalledWith(
      expect.objectContaining({
        classificationCode: "ADMINISTRATIVE_CONTACT",
        endedByUserId: 1,
      })
    );
  });
});
