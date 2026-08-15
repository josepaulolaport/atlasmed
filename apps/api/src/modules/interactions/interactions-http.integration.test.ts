import { describe, expect, it, mock } from "bun:test";
import { Elysia } from "elysia";
import { createGlobalScopeContext, type Role } from "@atlasmed/access";
import { AppError } from "../../shared/errors";
import { InteractionTransitionError } from "./application/use-cases/interaction.use-cases";
import { createInteractionRoutes, type InteractionHttpUseCases } from "./infrastructure/routes/interactions.route";

function actorPlugin(roleName: Role = "REP", userId = 1) {
  return new Elysia().derive({ as: "scoped" }, () => ({
    getUserId: async () => userId,
    getScope: async () => createGlobalScopeContext(),
    getAuthContext: async () => ({ userId, sessionId: "session", roleName }),
    getUser: async () => ({ id: userId, role: { name: roleName } }),

  }));
}

function useCases(overrides: Partial<InteractionHttpUseCases> = {}): InteractionHttpUseCases {
  const read = { execute: mock(async () => ({ id: 10, status: "SCHEDULED", canMutate: true })) };
  const mutate = { execute: mock(async () => ({ id: 10, status: "IN_PROGRESS", version: 2 })) };
  return { get: () => read, start: () => mutate, complete: () => mutate,
    recordOutcome: () => mutate, ...overrides };
}

function app(deps: InteractionHttpUseCases, role: Role = "REP") {
  return new Elysia().onError(({ code, error, set }) => {
    if (error instanceof AppError) { set.status = error.statusCode; return { error: error.toClientJSON() }; }
    if (code === "VALIDATION") { set.status = 400; return { error: { code: "VALIDATION_ERROR" } }; }
    set.status = 500; return { error: { code: "INTERNAL_SERVER_ERROR" } };
  }).use(createInteractionRoutes(deps, actorPlugin(role)));
}

describe("Interaction HTTP routes", () => {
  it("passes actor and scope to GET /interactions/:id", async () => {
    const execute = mock(async () => ({ id: 10, status: "SCHEDULED" }));
    const response = await app(useCases({ get: () => ({ execute }) as never })).handle(new Request("http://localhost/interactions/10"));
    expect(response.status).toBe(200);
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ id: 10, actor: { userId: 1, roleName: "REP" } }));
  });

  it("requires expectedVersion and Idempotency-Key for start and complete", async () => {
    const application = app(useCases());
    const missingKey = await application.handle(new Request("http://localhost/interactions/10/start", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ expectedVersion: 1 }),
    }));
    expect(missingKey.status).toBe(400);
    const missingVersion = await application.handle(new Request("http://localhost/interactions/10/complete", {
      method: "POST", headers: { "content-type": "application/json", "idempotency-key": "cmd" }, body: "{}",
    }));
    expect(missingVersion.status).toBe(400);
  });

  it("passes a trimmed correction reason to completion", async () => {
    const execute = mock(async () => ({ id: 10, status: "COMPLETED" }));
    const response = await app(useCases({ complete: () => ({ execute }) as never })).handle(new Request("http://localhost/interactions/10/complete", {
      method: "POST", headers: { "content-type": "application/json", "idempotency-key": "complete-1" },
      body: JSON.stringify({ expectedVersion: 2, correctionReason: "  Corrigido  " }),
    }));
    expect(response.status).toBe(200);
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ expectedVersion: 2, idempotencyKey: "complete-1", correctionReason: "Corrigido" }));
  });

  it("keeps managers read-only through INTERACTION permissions", async () => {
    const read = await app(useCases(), "MANAGER").handle(new Request("http://localhost/interactions/10"));
    expect(read.status).toBe(200);
    const write = await app(useCases(), "MANAGER").handle(new Request("http://localhost/interactions/10/start", {
      method: "POST", headers: { "content-type": "application/json", "idempotency-key": "cmd" }, body: JSON.stringify({ expectedVersion: 1 }),
    }));
    expect(write.status).toBe(403);
  });

  it("returns typed transition conflicts as 409", async () => {
    const execute = mock(async () => { throw new InteractionTransitionError("SCHEDULED", "COMPLETED"); });
    const response = await app(useCases({ complete: () => ({ execute }) as never })).handle(new Request("http://localhost/interactions/10/complete", {
      method: "POST", headers: { "content-type": "application/json", "idempotency-key": "cmd" }, body: JSON.stringify({ expectedVersion: 1 }),
    }));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual(expect.objectContaining({ error: expect.objectContaining({ code: "INTERACTION_INVALID_TRANSITION" }) }));
  });
});
