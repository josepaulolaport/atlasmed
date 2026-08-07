import { describe, expect, it, mock } from "bun:test";
import { createGlobalScopeContext, type Role } from "@atlasmed/access";
import { Elysia } from "elysia";
import {
  ResourceNotFoundError,
  UnauthorizedError,
} from "../../shared/errors";
import {
  authRequest,
  createHttpIntegrationApp,
} from "../../test-utils/http-integration-test";
import {
  createHealthcareProfessionalsRoutes,
  type HealthcareProfessionalsHttpUseCases,
} from "./infrastructure/routes/healthcare-professionals.route";
import {
  createPersonsRoutes,
  type PersonsHttpUseCases,
} from "./infrastructure/routes/persons.route";

function actorPlugin(roleName: Role = "REP", userId = 1) {
  return new Elysia().derive({ as: "scoped" }, () => ({
    getUserId: async () => userId,
    getScope: async () => createGlobalScopeContext(),
    getAuthContext: async () => ({ userId, sessionId: "session", roleName }),
    getUser: async () => ({ id: userId, role: { name: roleName } }),
    getAccessGrants: async () => [],
  }));
}

/** Mirrors production auth: missing Bearer → 401. */
function unauthenticatedPlugin() {
  return new Elysia().derive({ as: "scoped" }, () => {
    throw new UnauthorizedError();
  });
}

function personUseCases(
  overrides: Partial<PersonsHttpUseCases> = {}
): PersonsHttpUseCases {
  const person = {
    execute: mock(async () => ({
      id: 10,
      firstName: "Ana",
      lastName: "Silva",
      socialName: null,
      cpf: null,
      taxId: null,
      email: null,
      mobilePhone: null,
      landlinePhone: null,
      birthDate: null,
      favoriteTeam: null,
      hobbies: null,
      languages: null,
      imageUrl: null,
      facilityIds: [],
      hasHealthcareProfile: true,
    })),
  };
  const emptyNotes = { execute: mock(async () => []) };
  const relationship = {
    execute: mock(async () => ({ personId: 10, relationshipLevel: null })),
  };
  const mutated = { execute: mock(async () => ({ id: 1 })) };

  return {
    getPerson: () => person,
    patchPerson: () => mutated,
    listPersonNotes: () => emptyNotes,
    createPersonNote: () => mutated,
    getPersonRelationship: () => relationship,
    upsertPersonRelationship: () => mutated,
    ...overrides,
  };
}

function healthcareUseCases(
  overrides: Partial<HealthcareProfessionalsHttpUseCases> = {}
): HealthcareProfessionalsHttpUseCases {
  return {
    listHealthcareProfessionals: () => ({
      execute: mock(async () => ({ data: [], pagination: {} })),
    }),
    listHealthcareSpecialties: () => ({
      execute: mock(async () => ({ data: ["Cardiologia"] })),
    }),
    ...overrides,
  };
}

function app(
  persons: PersonsHttpUseCases = personUseCases(),
  healthcare: HealthcareProfessionalsHttpUseCases = healthcareUseCases(),
  role: Role | "unauthenticated" = "REP"
) {
  const authPlugin =
    role === "unauthenticated" ? unauthenticatedPlugin() : actorPlugin(role);

  return createHttpIntegrationApp(
    createPersonsRoutes(persons, authPlugin),
    createHealthcareProfessionalsRoutes(healthcare, authPlugin)
  );
}

describe("Person HTTP routes", () => {
  it("returns 401 without auth on GET /api/v1/persons/:id", async () => {
    const response = await authRequest(
      app(undefined, undefined, "unauthenticated"),
      "http://localhost/api/v1/persons/10",
      null
    );
    expect(response.status).toBe(401);
  });

  it("returns 401 without auth on GET /api/v1/healthcare-professionals", async () => {
    const response = await authRequest(
      app(undefined, undefined, "unauthenticated"),
      "http://localhost/api/v1/healthcare-professionals",
      null
    );
    expect(response.status).toBe(401);
  });

  it("returns 403 when OPS lacks update PERSON permission", async () => {
    const response = await authRequest(
      app(personUseCases(), healthcareUseCases(), "OPS"),
      "http://localhost/api/v1/persons/10",
      "token",
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ firstName: "Ana" }),
      }
    );
    expect(response.status).toBe(403);
  });

  it("returns 404 for missing/soft-deleted person on GET person, notes, relationship", async () => {
    const notFound = {
      execute: mock(async () => {
        throw new ResourceNotFoundError("Person", 999);
      }),
    };
    const application = app(
      personUseCases({
        getPerson: () => notFound,
        listPersonNotes: () => notFound,
        getPersonRelationship: () => notFound,
      })
    );

    for (const path of [
      "/api/v1/persons/999",
      "/api/v1/persons/999/notes",
      "/api/v1/persons/999/relationship",
    ]) {
      const response = await authRequest(
        application,
        `http://localhost${path}`,
        "token"
      );
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual(
        expect.objectContaining({
          error: expect.objectContaining({ code: "RESOURCE_NOT_FOUND" }),
        })
      );
    }
  });

  it("happy-path smoke: GET person, empty notes, null relationship, specialties array", async () => {
    const getPerson = mock(async () => ({
      id: 10,
      firstName: "Ana",
      lastName: "Silva",
      socialName: null,
      cpf: null,
      taxId: null,
      email: null,
      mobilePhone: null,
      landlinePhone: null,
      birthDate: null,
      favoriteTeam: null,
      hobbies: null,
      languages: null,
      imageUrl: null,
      facilityIds: [],
      hasHealthcareProfile: true,
    }));
    const listNotes = mock(async () => []);
    const getRelationship = mock(async () => ({
      personId: 10,
      relationshipLevel: null,
    }));
    const listSpecialties = mock(async () => ({ data: ["Cardiologia"] }));

    const application = app(
      personUseCases({
        getPerson: () => ({ execute: getPerson }),
        listPersonNotes: () => ({ execute: listNotes }),
        getPersonRelationship: () => ({ execute: getRelationship }),
      }),
      healthcareUseCases({
        listHealthcareSpecialties: () => ({ execute: listSpecialties }),
      })
    );

    const personResponse = await authRequest(
      application,
      "http://localhost/api/v1/persons/10",
      "token"
    );
    expect(personResponse.status).toBe(200);
    expect(await personResponse.json()).toEqual(
      expect.objectContaining({ id: 10, firstName: "Ana", lastName: "Silva" })
    );
    expect(getPerson).toHaveBeenCalledWith({ personId: 10 });

    const notesResponse = await authRequest(
      application,
      "http://localhost/api/v1/persons/10/notes",
      "token"
    );
    expect(notesResponse.status).toBe(200);
    expect(await notesResponse.json()).toEqual([]);
    expect(listNotes).toHaveBeenCalledWith({ personId: 10, userId: 1 });

    const relationshipResponse = await authRequest(
      application,
      "http://localhost/api/v1/persons/10/relationship",
      "token"
    );
    expect(relationshipResponse.status).toBe(200);
    expect(await relationshipResponse.json()).toEqual({
      personId: 10,
      relationshipLevel: null,
    });

    const specialtiesResponse = await authRequest(
      application,
      "http://localhost/api/v1/healthcare-professionals/specialties",
      "token"
    );
    expect(specialtiesResponse.status).toBe(200);
    const specialtiesBody = (await specialtiesResponse.json()) as {
      data: unknown[];
    };
    expect(Array.isArray(specialtiesBody.data)).toBe(true);
    expect(specialtiesBody.data).toEqual(["Cardiologia"]);
  });
});
