import { describe, expect, it } from "bun:test";
import { createGlobalScopeContext } from "@atlasmed/access";
import { Elysia } from "elysia";
import { AppError, ForbiddenError } from "../../shared/errors";
import { roteiroRoute, type RoteiroHttpUseCases } from "./infrastructure/routes/roteiro.route";

/**
 * The roteiro endpoints, mounted and called over HTTP.
 *
 * This layer is where three defects have already escaped: a missing comma
 * between two CTEs, a `schedule()` signature that never compiled, and
 * timestamps the driver returns as strings while the fake returns `Date`s.
 * Every one typechecked and passed the unit tests, because those drive a fake
 * repository. What is asserted here is only what nothing else can see — that
 * the body survives into the request the use case receives, that validation
 * rejects what it should, and that a domain refusal arrives as its own status
 * rather than a 500.
 */
function actorPlugin(role = "REP", userId = 7) {
  return new Elysia().derive({ as: "scoped" }, () => ({
    getUserId: async () => userId,
    getScope: async () => ({
      ...createGlobalScopeContext(),
      assignedVerticalIds: [1],
      managedUserIds: [],
    }),
    getAuthContext: async () => ({ userId, sessionId: "session", roleName: role }),
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

interface Captured {
  generate: unknown[];
  confirm: unknown[];
}

function build(options: {
  generate?: () => Promise<unknown>;
  confirm?: () => Promise<unknown>;
  role?: string;
} = {}) {
  const captured: Captured = { generate: [], confirm: [] };
  const useCases: RoteiroHttpUseCases = {
    generate: () => ({
      execute: async (input: never) => {
        captured.generate.push(input);
        return options.generate ? await options.generate() : { id: null, stops: [], notices: [] };
      },
    }),
    confirm: () => ({
      execute: async (input: never) => {
        captured.confirm.push(input);
        return options.confirm ? await options.confirm() : { id: 1, status: "CONFIRMED" };
      },
    }),
  };
  const app = errorEnvelope(
    roteiroRoute(useCases, actorPlugin(options.role) as never) as never,
  );
  return { app, captured };
}

const body = { verticalId: 1, origin: { lat: -23.55, lng: -46.63 } };

function post(path: string, payload?: unknown) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload ?? {}),
  });
}

describe("roteiro HTTP", () => {
  it("POST /roteiros/preview returns a slate and does not persist", async () => {
    const { app, captured } = build();

    const response = await app.handle(post("/roteiros/preview", body));

    expect(response.status).toBe(200);
    expect((captured.generate[0] as { persist?: boolean }).persist).toBeUndefined();
  });

  it("POST /roteiros asks the use case to persist", async () => {
    const { app, captured } = build();

    const response = await app.handle(post("/roteiros", body));

    expect(response.status).toBe(200);
    expect((captured.generate[0] as { persist?: boolean }).persist).toBe(true);
  });

  it("carries the origin, linha and limit through to the use case", async () => {
    const { app, captured } = build();

    await app.handle(post("/roteiros", { ...body, limit: 3, subjectUserId: 9 }));

    const input = captured.generate[0] as {
      origin: { lat: number; lng: number };
      verticalId: number;
      limit: number;
      subjectUserId: number;
    };
    expect(input.origin).toEqual({ lat: -23.55, lng: -46.63 });
    expect(input.verticalId).toBe(1);
    expect(input.limit).toBe(3);
    expect(input.subjectUserId).toBe(9);
  });

  it("derives the rep's civil date rather than the server's", async () => {
    const { app, captured } = build();

    await app.handle(post("/roteiros", { ...body, timeZone: "America/Sao_Paulo" }));

    const input = captured.generate[0] as { today: string; timeZone: string };
    expect(input.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(input.timeZone).toBe("America/Sao_Paulo");
  });

  it("accepts a request with no origin — the day's first booking is the fallback", async () => {
    // Live GPS answers "where am I", which says nothing about tomorrow. The
    // engine resolves the origin from the schedule and refuses only when the
    // day has nothing booked to start from (§15.4.1).
    const { app, captured } = build();

    const response = await app.handle(post("/roteiros", { verticalId: 1 }));

    expect(response.status).toBe(200);
    expect((captured.generate[0] as { origin?: unknown }).origin).toBeUndefined();
  });

  it("plans the day it was given, not today", async () => {
    const { app, captured } = build();

    await app.handle(post("/roteiros", { ...body, scopeDate: "2026-09-01" }));

    expect((captured.generate[0] as { today: string }).today).toBe("2026-09-01");
  });

  it("carries the rep's removals and additions through", async () => {
    const { app, captured } = build();

    await app.handle(
      post("/roteiros", { ...body, excludeProfileIds: [7, 8], includeProfileIds: [42] }),
    );

    const input = captured.generate[0] as {
      excludeProfileIds: number[];
      includeProfileIds: number[];
    };
    expect(input.excludeProfileIds).toEqual([7, 8]);
    expect(input.includeProfileIds).toEqual([42]);
  });

  it("rejects a malformed scopeDate", async () => {
    const { app } = build();

    const response = await app.handle(post("/roteiros", { ...body, scopeDate: "01/09/2026" }));

    expect(response.status).toBe(400);
  });

  it("rejects an out-of-range coordinate", async () => {
    const { app } = build();

    const response = await app.handle(
      post("/roteiros", { verticalId: 1, origin: { lat: 999, lng: -46.63 } }),
    );

    expect(response.status).toBe(400);
  });

  it("rejects a limit above the hard ceiling", async () => {
    const { app } = build();

    const response = await app.handle(post("/roteiros", { ...body, limit: 50 }));

    expect(response.status).toBe(400);
  });

  it("surfaces a domain refusal as its own status, not a 500", async () => {
    const { app } = build({
      generate: async () => {
        throw new ForbiddenError("Roteiro is outside the current owner/team scope");
      },
    });

    const response = await app.handle(post("/roteiros", body));

    expect(response.status).toBe(403);
  });

  it("POST /roteiros/:id/confirm passes the id through", async () => {
    const { app, captured } = build();

    const response = await app.handle(post("/roteiros/17/confirm"));

    expect(response.status).toBe(200);
    expect((captured.confirm[0] as { roteiroId: number }).roteiroId).toBe(17);
  });

  it("rejects a non-numeric roteiro id", async () => {
    const { app } = build();

    const response = await app.handle(post("/roteiros/abc/confirm"));

    expect(response.status).toBe(400);
  });

  it("returns 409 when the calendar changed under a confirm", async () => {
    // §7.3 — the rep's times are never silently shifted; the clash is reported.
    class Conflict extends AppError {
      constructor() {
        super("CALENDAR_CONFLICT", 409, "Calendar conflict", {});
      }
    }
    const { app } = build({
      confirm: async () => {
        throw new Conflict();
      },
    });

    const response = await app.handle(post("/roteiros/17/confirm"));

    expect(response.status).toBe(409);
  });
});
