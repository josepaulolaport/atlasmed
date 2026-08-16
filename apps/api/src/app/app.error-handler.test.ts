import { describe, expect, it } from "bun:test";
import { HttpError } from "@atlasmed/access";
import { BadRequestException } from "elysia-http-exception";
import app from "./app";
import { AppError } from "../shared/errors";

class TestHttpError extends HttpError {
  constructor() {
    super("HTTP test error", 409, "HTTP_TEST_ERROR");
  }
}

class TestAppError extends AppError {
  constructor() {
    super("TEST_ERROR", 418, "Test app error", { secret: "hidden" });
  }
}

const errorTestApp = app
  .get("/__test/errors/app", () => {
    throw new TestAppError();
  })
  .get("/__test/errors/http", () => {
    throw new TestHttpError();
  })
  .get("/__test/errors/library", () => {
    throw new BadRequestException("Library exception");
  })
  .get("/__test/errors/unexpected", () => {
    throw new Error("database password leaked");
  })
  // Shaped like what the `postgres` driver throws, wrapped the way Drizzle
  // wraps it — the SQLSTATE is one level down, on `cause`.
  .get("/__test/errors/duplicate", () => {
    throw Object.assign(new Error("insert failed"), {
      cause: Object.assign(new Error("duplicate key"), {
        code: "23505",
        constraint: "products_simpro_code_unique",
      }),
    });
  })
  .get("/__test/errors/still-referenced", () => {
    throw Object.assign(new Error("delete failed"), {
      code: "23503",
      constraint: "facility_product_usage_competitor_fk",
    });
  })
  .get("/__test/errors/check-violation", () => {
    throw Object.assign(new Error("check failed"), {
      code: "23514",
      constraint: "facility_product_usage_quantity_positive",
    });
  });

async function request(path: string, init?: RequestInit) {
  return errorTestApp.handle(new Request(`http://localhost${path}`, init));
}

describe("global error handler", () => {
  it("maps an unknown route to a sanitized 404 envelope", async () => {
    const response = await request("/__test/route-does-not-exist");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: {
        code: "ROUTE_NOT_FOUND",
        message: "Route not found",
      },
    });
    expect(response.headers.get("x-request-id")).toBeTruthy();
  });

  it("returns Elysia's validation detail without echoing submitted values", async () => {
    const response = await request("/api/v1/session/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        identifier: 123,
        password: "secret-token",
        healthData: "sensitive diagnosis",
      }),
    });
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      type: "validation",
      on: "body",
    });
    // detail() is kept per project convention, but `found` (the submitted
    // payload) and errors[].value (per-field submitted values) are stripped
    // so credentials/health data are never echoed back.
    expect(body).not.toMatchObject({ found: expect.anything() });
    expect(serialized).not.toContain("secret-token");
    expect(serialized).not.toContain("sensitive diagnosis");
  });

  it("maps malformed JSON to a stable parse error", async () => {
    const response = await request("/api/v1/session/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: '{"identifier":"patient@example.com","password":"secret',
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: "INVALID_JSON",
        message: "Request body contains invalid JSON",
      },
    });
  });

  it("preserves sanitized AppError status and body", async () => {
    const response = await request("/__test/errors/app");

    expect(response.status).toBe(418);
    expect(await response.json()).toEqual({
      error: { code: "TEST_ERROR", message: "Test app error" },
    });
  });

  /**
   * Spec 0016: the admin panel lets someone type a duplicate code or remove a
   * row something still points at. Both are Postgres constraint violations, and
   * both used to fall through to `500 An unexpected error occurred` — which
   * reads as our fault and tells the admin nothing about what to change.
   */
  it("maps a duplicate key to 409 without naming the constraint", async () => {
    const response = await request("/__test/errors/duplicate");

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: {
        code: "RESOURCE_CONFLICT",
        message: "A record with this value already exists.",
      },
    });
    // The index name is ours, not the caller's business — it stays in the logs.
    expect(await request("/__test/errors/duplicate").then((r) => r.text())).not.toContain(
      "products_simpro_code_unique"
    );
  });

  it("maps a foreign key violation to 409", async () => {
    // The delete guards in spec 0016 §6.2 catch this first; this is the race
    // they cannot close, and it must not surface as a 500.
    const response = await request("/__test/errors/still-referenced");

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: { code: "RESOURCE_IN_USE" },
    });
  });

  it("maps a check violation to 400, not 500", async () => {
    const response = await request("/__test/errors/check-violation");

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "CONSTRAINT_VIOLATION" },
    });
  });

  it("preserves shared HttpError status and body", async () => {
    const response = await request("/__test/errors/http");

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: { code: "HTTP_TEST_ERROR", message: "HTTP test error" },
    });
  });

  it("preserves AtlasMed envelope for library HTTP exceptions", async () => {
    const response = await request("/__test/errors/library");

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { code: "BAD_REQUEST", message: "Library exception" },
    });
    expect(response.headers.get("x-request-id")).toBeTruthy();
  });

  it("never exposes unexpected error details", async () => {
    const response = await request("/__test/errors/unexpected");
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred. Please try again later.",
      },
    });
    expect(JSON.stringify(body)).not.toContain("database password leaked");
  });
});
