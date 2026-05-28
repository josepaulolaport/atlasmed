import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import {
  ForbiddenError,
  UnauthorizedError,
} from "../shared/errors";
import { AppError } from "../shared/errors";

class TestAppError extends AppError {
  constructor() {
    super("TEST_ERROR", 418, "Test app error");
  }
}

function createErrorHandlerApp() {
  return new Elysia().onError(({ error, set }) => {
    if (error instanceof AppError) {
      set.status = error.statusCode;
      return { error: error.toClientJSON() };
    }

    set.status = 500;
    return {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
      },
    };
  });
}

describe("global error handler", () => {
  it("returns 401 with structured body for UnauthorizedError", async () => {
    const app = createErrorHandlerApp().get("/test", () => {
      throw new UnauthorizedError("Missing token");
    });

    const response = await app.handle(new Request("http://localhost/test"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Missing token",
      },
    });
  });

  it("returns 403 with structured body for ForbiddenError", async () => {
    const app = createErrorHandlerApp().get("/test", () => {
      throw new ForbiddenError("Insufficient permissions");
    });

    const response = await app.handle(new Request("http://localhost/test"));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({
      error: {
        code: "FORBIDDEN",
        message: "Insufficient permissions",
      },
    });
  });

  it("preserves AppError response shape", async () => {
    const app = createErrorHandlerApp().get("/test", () => {
      throw new TestAppError();
    });

    const response = await app.handle(new Request("http://localhost/test"));
    const body = (await response.json()) as {
      error: { code: string; message: string };
    };

    expect(response.status).toBe(418);
    expect(body.error.code).toBe("TEST_ERROR");
    expect(body.error.message).toBe("Test app error");
  });
});
