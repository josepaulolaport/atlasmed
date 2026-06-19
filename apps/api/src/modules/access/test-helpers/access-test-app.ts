import { Elysia } from "elysia";
import { AppError } from "../../../shared/errors";

/**
 * Elysia app wrapper with the same AppError JSON shape used in route/plugin tests.
 */
export function createAccessTestApp() {
  return new Elysia().onError(({ error, set }) => {
    if (error instanceof AppError) {
      set.status = error.statusCode;
      return { error: error.toClientJSON() };
    }

    set.status = 500;
    return {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : String(error),
      },
    };
  });
}

export function bearerAuth(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

export async function parseJsonResponse<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}
