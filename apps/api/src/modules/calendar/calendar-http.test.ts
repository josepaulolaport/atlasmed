import { describe, expect, it, mock } from "bun:test";
import { Elysia } from "elysia";
import { createGlobalScopeContext, type Role } from "@atlasmed/access";
import { AppError } from "../../shared/errors";
import { createCalendarRoutes, type CalendarHttpUseCases } from "./infrastructure/routes/calendar.route";

function actorPlugin(roleName: Role = "REP", userId = "rep-1") {
  return new Elysia().derive({ as: "scoped" }, () => ({
    getUserId: async () => userId,
    getScope: async () => createGlobalScopeContext(),
    getAuthContext: async () => ({ userId, sessionId: "session", roleName }),
    getUser: async () => ({ id: userId, role: { name: roleName } }),
    getAccessGrants: async () => [],
  }));
}

function useCases(overrides: Partial<CalendarHttpUseCases> = {}): CalendarHttpUseCases {
  const empty = { execute: mock(async () => []) };
  const mutated = { execute: mock(async () => ({ id: "calendar-1" })) };
  return {
    list: () => empty,
    availability: () => empty,
    create: () => mutated,
    update: () => mutated,
    updateOccurrence: () => mutated,
    cancel: () => mutated,
    cancelOccurrence: () => mutated,
    ...overrides,
  };
}

function app(deps: CalendarHttpUseCases, role: Role = "REP") {
  return new Elysia().onError(({ code, error, set }) => {
    if (error instanceof AppError) { set.status = error.statusCode; return { error: error.toClientJSON() }; }
    if (code === "VALIDATION") { set.status = 400; return { error: { code: "VALIDATION_ERROR" } }; }
    set.status = 500; return { error: { code: "INTERNAL_SERVER_ERROR" } };
  }).use(createCalendarRoutes(deps, actorPlugin(role)));
}

const validBody = {
  kind: "INTERACTION",
  title: "Visita",
  facilityId: "facility-1",
  modality: "REMOTE",
  startsAt: "2026-08-03T09:00:00-03:00",
  timeZone: "America/Sao_Paulo",
  durationMinutes: 60,
  recurrence: "NONE",
};

describe("Calendar HTTP routes", () => {
  it("passes auth context, scope, query dates and owner to list", async () => {
    const execute = mock(async () => []);
    const response = await app(useCases({ list: () => ({ execute }) as any })).handle(new Request(
      "http://localhost/calendar?from=2026-08-01T00:00:00Z&to=2026-09-01T00:00:00Z&ownerUserId=rep-2",
    ));
    expect(response.status).toBe(200);
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      actor: { userId: "rep-1", roleName: "REP" }, ownerUserId: "rep-2",
      from: new Date("2026-08-01T00:00:00Z"), to: new Date("2026-09-01T00:00:00Z"),
    }));
  });

  it("requires idempotency-key and validates the discriminated create contract", async () => {
    const application = app(useCases());
    const missingKey = await application.handle(new Request("http://localhost/calendar", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(validBody),
    }));
    expect(missingKey.status).toBe(400);

    const invalidBlock = await application.handle(new Request("http://localhost/calendar", {
      method: "POST", headers: { "content-type": "application/json", "idempotency-key": "cmd" },
      body: JSON.stringify({ ...validBody, kind: "PERSONAL_BLOCK" }),
    }));
    expect(invalidBlock.status).toBe(400);

    const invalidDuration = await application.handle(new Request("http://localhost/calendar", {
      method: "POST", headers: { "content-type": "application/json", "idempotency-key": "cmd" },
      body: JSON.stringify({ ...validBody, durationMinutes: 45 }),
    }));
    expect(invalidDuration.status).toBe(400);
  });

  it("rejects ranges longer than 366 days", async () => {
    const response = await app(useCases()).handle(new Request(
      "http://localhost/calendar?from=2026-01-01T00:00:00Z&to=2027-01-03T00:00:00Z",
    ));
    expect(response.status).toBe(400);
  });

  it("fully validates merged recurrence rules on update", async () => {
    const application = app(useCases());
    const invalidZone = await application.handle(new Request("http://localhost/calendar/calendar-1", {
      method: "PATCH", headers: { "content-type": "application/json", "idempotency-key": "cmd-zone" },
      body: JSON.stringify({ expectedVersion: 1, timeZone: "Mars/Olympus" }),
    }));
    expect(invalidZone.status).toBe(400);

    const invalidBounds = await application.handle(new Request("http://localhost/calendar/calendar-1", {
      method: "PATCH", headers: { "content-type": "application/json", "idempotency-key": "cmd-bounds" },
      body: JSON.stringify({ expectedVersion: 1, recurrence: "NONE", recurrenceCount: 2 }),
    }));
    expect(invalidBounds.status).toBe(400);
  });

  it("uses the authenticated actor as owner and accepts a valid interaction", async () => {
    const execute = mock(async () => ({ id: "created" }));
    const response = await app(useCases({ create: () => ({ execute }) as any })).handle(new Request("http://localhost/calendar", {
      method: "POST", headers: { "content-type": "application/json", "idempotency-key": "create-1" }, body: JSON.stringify(validBody),
    }));
    expect(response.status).toBe(200);
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ actor: { userId: "rep-1", roleName: "REP" }, idempotencyKey: "create-1" }));
  });

  it("keeps managers read-only through CALENDAR permissions", async () => {
    const read = await app(useCases(), "MANAGER").handle(new Request("http://localhost/calendar?from=2026-08-01T00:00:00Z&to=2026-09-01T00:00:00Z"));
    expect(read.status).toBe(200);
    const write = await app(useCases(), "MANAGER").handle(new Request("http://localhost/calendar", {
      method: "POST", headers: { "content-type": "application/json", "idempotency-key": "cmd" }, body: JSON.stringify(validBody),
    }));
    expect(write.status).toBe(403);
  });

  it("requires expectedVersion, idempotency key, and cancellation reason on mutations", async () => {
    const application = app(useCases());
    const patch = await application.handle(new Request("http://localhost/calendar/calendar-1", {
      method: "PATCH", headers: { "content-type": "application/json", "idempotency-key": "cmd" }, body: JSON.stringify({ title: "Novo" }),
    }));
    expect(patch.status).toBe(400);
    const cancellation = await application.handle(new Request("http://localhost/calendar/calendar-1", {
      method: "DELETE", headers: { "content-type": "application/json", "idempotency-key": "cmd" }, body: JSON.stringify({ expectedVersion: 1, reason: "   " }),
    }));
    expect(cancellation.status).toBe(400);
  });
});
