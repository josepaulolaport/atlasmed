import { describe, expect, it, mock } from "bun:test";
import { createGlobalScopeContext } from "@atlasmed/access";
import { Elysia } from "elysia";
import { AppError } from "../../shared/errors";
import { createOrdersRoutes, type OrdersHttpUseCases } from "./infrastructure/routes/orders.route";

function actorPlugin() {
  return new Elysia().derive({ as: "scoped" }, () => ({
    getUserId: async () => 1,
    getScope: async () => ({ ...createGlobalScopeContext(), assignedVerticalIds: [1] }),
    getAuthContext: async () => ({ userId: 1, sessionId: "session", roleName: "REP" as const }),
    getUser: async () => ({ id: 1, role: { name: "REP" as const } }),
    getAccessGrants: async () => [],
  }));
}

function useCases(
  createExecute = mock(async () => ({ id: 1 })),
  listExecute = async () => ({ data: [], pagination: {} }),
): OrdersHttpUseCases {
  return {
    listOrders: () => ({ execute: listExecute }),
    getOrder: () => ({ execute: async () => ({ id: 1 }) }),
    createOrder: () => ({ execute: createExecute }),
  };
}

function app(deps: OrdersHttpUseCases) {
  return new Elysia().onError(({ code, error, set }) => {
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
  }).use(createOrdersRoutes(deps, actorPlugin()));
}

const body = {
  facilityId: 1,
  items: [{ productId: 1, quantity: 1 }],
};

describe("Order HTTP routes", () => {
  it("passes facilityId filter and actor context to GET /orders", async () => {
    const execute = mock(async () => ({ data: [], pagination: {} }));
    const response = await app(useCases(undefined, execute)).handle(new Request("http://localhost/orders?facilityId=1"));

    expect(response.status).toBe(200);
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      facilityId: 1,
      actor: { userId: 1, roleName: "REP" },
    }));
  });

  it("rejects invalid create payloads at the route layer", async () => {
    const response = await app(useCases()).handle(new Request("http://localhost/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items: [{ productId: 1, quantity: 1 }] }),
    }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(expect.objectContaining({
      error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
    }));
  });

  it("passes numeric facility and product ids to order creation", async () => {
    const execute = mock(async () => ({ id: 1 }));
    const response = await app(useCases(execute)).handle(new Request("http://localhost/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }));

    expect(response.status).toBe(200);
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      facilityId: 1,
      items: [expect.objectContaining({ productId: 1, quantity: 1 })],
    }));
  });
});
