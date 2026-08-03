import { describe, expect, it, mock } from "bun:test";
import { createGlobalScopeContext } from "@atlasmed/access";
import { Elysia } from "elysia";
import { AppError } from "../../shared/errors";
import { createOrdersRoutes, type OrdersHttpUseCases } from "./infrastructure/routes/orders.route";

function actorPlugin() {
  return new Elysia().derive({ as: "scoped" }, () => ({
    getUserId: async () => "rep-1",
    getScope: async () => ({ ...createGlobalScopeContext(), assignedVerticalIds: ["vertical-1"] }),
    getAuthContext: async () => ({ userId: "rep-1", sessionId: "session", roleName: "REP" as const }),
    getUser: async () => ({ id: "rep-1", role: { name: "REP" as const } }),
    getAccessGrants: async () => [],
  }));
}

function useCases(
  createExecute = mock(async () => ({ id: "order-1" })),
  listExecute = async () => ({ data: [], pagination: {} }),
): OrdersHttpUseCases {
  return {
    listOrders: () => ({ execute: listExecute }),
    getOrder: () => ({ execute: async () => ({ id: "order-1" }) }),
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
  facilityId: "facility-1",
  items: [{ productId: "product-1", quantity: 1 }],
};

describe("Order HTTP routes", () => {
  it("passes interactionId and actor context to GET /orders", async () => {
    const execute = mock(async () => ({ data: [], pagination: {} }));
    const response = await app(useCases(undefined, execute)).handle(new Request("http://localhost/orders?interactionId=interaction-1"));

    expect(response.status).toBe(200);
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      interactionId: "interaction-1",
      actor: { userId: "rep-1", roleName: "REP" },
    }));
  });

  it("requires Idempotency-Key for POST /orders", async () => {
    const response = await app(useCases()).handle(new Request("http://localhost/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(expect.objectContaining({
      error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
    }));
  });

  it("passes the trimmed Idempotency-Key to order creation", async () => {
    const execute = mock(async () => ({ id: "order-1" }));
    const response = await app(useCases(execute)).handle(new Request("http://localhost/orders", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "  order-key-1  " },
      body: JSON.stringify(body),
    }));

    expect(response.status).toBe(200);
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: "order-key-1" }));
  });
});
