import { Elysia, type AnyElysia } from "elysia";
import { HttpError } from "@atlasmed/access";
import { AppError } from "../shared/errors";

export function createHttpIntegrationApp(...modules: AnyElysia[]) {
  let group = new Elysia();

  for (const module of modules) {
    group = group.use(module);
  }

  return new Elysia()
    .onError(({ error, set }) => {
      if (error instanceof AppError) {
        set.status = error.statusCode;
        return { error: error.toClientJSON() };
      }

      if (error instanceof HttpError) {
        set.status = error.statusCode;
        return { error: error.toJSON() };
      }

      set.status = 500;
      return {
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : String(error),
        },
      };
    })
    .group("/api/v1", (app) => app.use(group));
}

export type HttpIntegrationApp = ReturnType<typeof createHttpIntegrationApp>;

export function authRequest(
  app: HttpIntegrationApp,
  url: string,
  token: string | null,
  init?: RequestInit
) {
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> | undefined),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return app.handle(
    new Request(url, {
      ...init,
      headers,
    })
  );
}
