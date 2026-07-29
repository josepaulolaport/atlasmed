import { describe, expect, it } from "bun:test";
import { HttpError } from "@atlasmed/access";
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
  .get("/__test/errors/unexpected", () => {
    throw new Error("database password leaked");
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

  it("normalizes validation issues without echoing found values or schemas", async () => {
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
    expect(body).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request data",
        issues: [
          { field: "identifier", message: "Invalid value" },
        ],
      },
    });
    expect(serialized).not.toContain("secret-token");
    expect(serialized).not.toContain("sensitive diagnosis");
    expect(serialized).not.toContain("found");
    expect(serialized).not.toContain("schema");
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

  it("preserves shared HttpError status and body", async () => {
    const response = await request("/__test/errors/http");

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: { code: "HTTP_TEST_ERROR", message: "HTTP test error" },
    });
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
