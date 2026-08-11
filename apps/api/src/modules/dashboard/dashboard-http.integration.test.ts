import { describe, expect, it, mock } from "bun:test";
import { createGlobalScopeContext } from "@atlasmed/access";
import { Elysia } from "elysia";
import { AppError, ForbiddenError } from "../../shared/errors";
import {
  createDashboardRoutes,
  type DashboardHttpUseCases,
} from "./infrastructure/routes/dashboard.route";
import {
  createTeamRoutes,
  type TeamHttpUseCases,
} from "./infrastructure/routes/team.route";

/**
 * The dashboard and team endpoints, mounted and called over HTTP.
 *
 * Spec 0014 §8.1 recorded these as "not built" because the routes imported
 * `composition` directly and could not be mounted. That gap is not academic:
 * `GET /dashboard/metrics/orders` shipped as a 500 on every call, and the unit
 * tests underneath it all passed. These assert the layer nothing else covers —
 * that query parameters survive into the request the use case receives, that
 * validation rejects what it should, and that a domain refusal reaches the
 * client as its own status rather than a 500.
 */
function actorPlugin(role = "MANAGER", userId = 2) {
  return new Elysia().derive({ as: "scoped" }, () => ({
    getUserId: async () => userId,
    getScope: async () => ({
      ...createGlobalScopeContext(),
      assignedVerticalIds: [1],
      managedUserIds: [5],
    }),
    getAuthContext: async () => ({
      userId,
      sessionId: "session",
      roleName: role,
    }),
    getUser: async () => ({ id: userId, role: { name: role } }),
  }));
}

function errorEnvelope(app: never) {
  return new Elysia()
    .onError(({ code, error, set }) => {
      if (error instanceof AppError) {
        set.status = error.statusCode;
        return { error: error.toClientJSON() };
      }
      if (code === "VALIDATION") {
        set.status = 400;
        return { error: { code: "VALIDATION_ERROR" } };
      }
      set.status = 500;
      return { error: { code: "INTERNAL_SERVER_ERROR" } };
    })
    .use(app);
}

function dashboardUseCases(
  overrides: Partial<Record<keyof DashboardHttpUseCases, () => unknown>> = {},
): DashboardHttpUseCases {
  const stub = () => ({ execute: async () => ({ verticalId: 1, value: 0 }) });
  return {
    getAssignedClinics: stub,
    getCoverage: stub,
    getPurchaseBuckets: stub,
    getCadastroCompletion: stub,
    getOrders: stub,
    getPenetration: stub,
    getUnassignedClinics: stub,
    getTerritory: stub,
    listMetricClinics: stub,
    ...overrides,
  } as DashboardHttpUseCases;
}

function dashboardApp(deps: DashboardHttpUseCases, role = "MANAGER") {
  return errorEnvelope(
    createDashboardRoutes(deps, actorPlugin(role) as never) as never,
  );
}

function teamApp(deps: TeamHttpUseCases, role = "MANAGER") {
  return errorEnvelope(
    createTeamRoutes(deps, actorPlugin(role) as never) as never,
  );
}

describe("dashboard HTTP routes", () => {
  it("carries the linha, the subject and every filter into the use case", async () => {
    const execute = mock(async () => ({ verticalId: 1, value: 7 }));
    const app = dashboardApp(
      dashboardUseCases({ getAssignedClinics: () => ({ execute }) }),
    );

    const response = await app.handle(
      new Request(
        "http://localhost/dashboard/metrics/assigned-clinics" +
          "?verticalId=1&subjectUserId=5&stateId=33&municipalityId=3304557&unitTypeId=4&managerId=2&repId=5",
      ),
    );

    expect(response.status).toBe(200);
    // Spec 0014 §5: filters apply uniformly, so every one of them has to
    // survive the trip. A dropped filter is a metric answering for a wider
    // population than the screen says it is.
    expect(execute).toHaveBeenCalledWith({
      viewerId: 2,
      viewerRole: "MANAGER",
      scope: expect.objectContaining({ assignedVerticalIds: [1] }),
      verticalId: 1,
      subjectUserId: 5,
      filters: {
        unitTypeId: 4,
        managerId: 2,
        repId: 5,
        stateId: 33,
        municipalityId: 3304557,
      },
    });
  });

  it("defaults the linha and the subject to null rather than guessing", async () => {
    const execute = mock(async () => ({ verticalId: 1, value: 0 }));
    await dashboardApp(
      dashboardUseCases({ getCoverage: () => ({ execute }) }),
    ).handle(new Request("http://localhost/dashboard/metrics/coverage"));

    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({ verticalId: null, subjectUserId: null }),
    );
  });

  it("mounts every metric endpoint", async () => {
    const app = dashboardApp(dashboardUseCases());
    for (const path of [
      "assigned-clinics",
      "coverage",
      "purchase-buckets",
      "cadastro-completion",
      "orders",
      "penetration",
      "unassigned-clinics",
    ]) {
      const response = await app.handle(
        new Request(`http://localhost/dashboard/metrics/${path}?verticalId=1`),
      );
      expect([path, response.status]).toEqual([path, 200]);
    }
    expect(
      (
        await app.handle(
          new Request("http://localhost/dashboard/territory?verticalId=1"),
        )
      ).status,
    ).toBe(200);
  });

  it("refuses a rep the unassigned-clinics metric with 403, not 500", async () => {
    const app = dashboardApp(
      dashboardUseCases({
        getUnassignedClinics: () => ({
          execute: async () => {
            throw new ForbiddenError();
          },
        }),
      }),
      "REP",
    );

    const response = await app.handle(
      new Request("http://localhost/dashboard/metrics/unassigned-clinics"),
    );
    expect(response.status).toBe(403);
  });

  it("rejects an unknown metric key at the route layer", async () => {
    const response = await dashboardApp(dashboardUseCases()).handle(
      new Request("http://localhost/dashboard/metrics/made-up/clinics"),
    );
    expect(response.status).toBe(400);
  });

  it("defaults pagination and passes the metric key through", async () => {
    const execute = mock(async () => ({ data: [], total: 0 }));
    await dashboardApp(
      dashboardUseCases({ listMetricClinics: () => ({ execute }) }),
    ).handle(
      new Request("http://localhost/dashboard/metrics/bucket-active/clinics"),
    );

    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({ metric: "bucket-active", page: 1, limit: 25 }),
    );
  });

  it("refuses a page size beyond the cap", async () => {
    const response = await dashboardApp(dashboardUseCases()).handle(
      new Request(
        "http://localhost/dashboard/metrics/coverage/clinics?limit=5000",
      ),
    );
    expect(response.status).toBe(400);
  });
});

describe("team HTTP routes", () => {
  function teamUseCases(
    listTeamExecute = mock(async () => ({ data: [] })),
    repsExecute = mock(async () => ({ data: [] })),
  ): TeamHttpUseCases {
    return {
      listTeam: () => ({ execute: listTeamExecute }),
      listRepsWithoutPatch: () => ({ execute: repsExecute }),
    } as TeamHttpUseCases;
  }

  it("passes the sort key and direction that turn the roster into a leaderboard", async () => {
    const execute = mock(async () => ({ data: [] }));
    const response = await teamApp(teamUseCases(execute)).handle(
      new Request(
        "http://localhost/team?verticalId=1&sortBy=coverage&order=desc&managerId=2",
      ),
    );

    expect(response.status).toBe(200);
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        viewerId: 2,
        viewerRole: "MANAGER",
        verticalId: 1,
        managerId: 2,
        sortBy: "coverage",
        order: "desc",
      }),
    );
  });

  it("rejects a sort key the roster cannot compute", async () => {
    const response = await teamApp(teamUseCases()).handle(
      new Request("http://localhost/team?sortBy=vibes"),
    );
    expect(response.status).toBe(400);
  });

  it("routes reps-without-patch to its own use case, not to the roster", async () => {
    // The literal segment has to win over `""`; if the roster shadowed it, this
    // would silently return a team list under a URL that promises a defect
    // roster.
    const listTeam = mock(async () => ({ data: [] }));
    const reps = mock(async () => ({ data: [] }));
    const response = await teamApp(teamUseCases(listTeam, reps), "ADMIN").handle(
      new Request("http://localhost/team/reps-without-patch"),
    );

    expect(response.status).toBe(200);
    expect(reps).toHaveBeenCalledWith({ viewerRole: "ADMIN" });
    expect(listTeam).not.toHaveBeenCalled();
  });
});
