import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { openapi } from "@elysiajs/openapi";
import { swagger } from "@elysiajs/swagger";
import { httpExceptionPlugin } from "elysia-http-exception";
import { healthRoute } from "../infrastructure/health/health.route";
import { access, user as profileUser } from "../modules/access";
import { sessions } from "../modules/sessions";
import { facility } from "../modules/facility";
import { person } from "../modules/person";
import { fieldSuggestions } from "../modules/field-suggestions";
import { catalog } from "../modules/catalog";
import { searchSync } from "../modules/search-sync";
import { schedules } from "../modules/schedules";
import { territory } from "../modules/territory";
import { maps } from "../modules/maps";
import { orders } from "../modules/orders";
import { potential } from "../modules/potential";
import { visits } from "../modules/visits";
import { dashboard } from "../modules/dashboard";
import { calendar } from "../modules/calendar";
import { interactions } from "../modules/interactions";
import { user as avatarUser } from "../modules/user";
import { HttpError } from "@atlasmed/access";
import { AppError } from "../shared/errors";
import { environment } from "./config/environment";
import { observabilityPlugin } from "../infrastructure/plugins/observability.plugin";
import { auditMiddleware } from "../infrastructure/audit/audit.middleware";
import { API_VERSION } from "./versioning";
import { apiDocumentation } from "./documentation";
import { hasDuplicatePathSlashes } from "./request-path";

type ValidationIssue = {
  field: string;
  message: string;
};

function normalizeValidationField(path: unknown): string {
  if (typeof path !== "string") return "request";

  const field = path
    .replace(/^\//, "")
    .split("/")
    .filter(Boolean)
    .join(".");

  return field || "request";
}

function normalizeValidationIssues(error: unknown): ValidationIssue[] {
  if (
    !error ||
    typeof error !== "object" ||
    !("all" in error) ||
    !Array.isArray(error.all)
  ) {
    return [{ field: "request", message: "Invalid value" }];
  }

  const issues = error.all.flatMap((issue) => {
    if (!issue || typeof issue !== "object") return [];

    const path = "path" in issue ? issue.path : undefined;

    return [{
      field: normalizeValidationField(path),
      message: "Invalid value",
    }];
  });

  return issues.length > 0
    ? issues
    : [{ field: "request", message: "Invalid value" }];
}

const configuredCorsOrigins = environment.CORS_ORIGINS.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const firebaseHostingOrigins =
  /^https:\/\/atlasmed-app(?:--[a-z0-9-]+)?\.web\.app$/;

const app = new Elysia()
  // Observability MUST come first to track all requests
  .use(observabilityPlugin)
  .onRequest(({ request, set }) => {
    if (!hasDuplicatePathSlashes(request)) return;

    set.status = 400;
    return {
      error: {
        code: "INVALID_REQUEST_PATH",
        message: "Request path must not contain duplicate slashes",
      },
    };
  })

  // Apply global error handler
  .onError(({ code, error, set }) => {
    // Handle custom AppError instances
    if (error instanceof AppError) {
      set.status = error.statusCode;
      return {
        error: error.toClientJSON(),
      };
    }

    // Handle shared HttpError instances (auth plugin, permission middleware, etc.)
    if (error instanceof HttpError) {
      set.status = error.statusCode;
      return {
        error: error.toJSON(),
      };
    }

    if (code === "VALIDATION") {
      set.status = 400;
      return {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request data",
          issues: normalizeValidationIssues(error),
        },
      };
    }

    if (code === "PARSE") {
      set.status = 400;
      return {
        error: {
          code: "INVALID_JSON",
          message: "Request body contains invalid JSON",
        },
      };
    }

    if (code === "INVALID_COOKIE_SIGNATURE") {
      set.status = 400;
      return {
        error: {
          code: "INVALID_COOKIE_SIGNATURE",
          message: "Invalid cookie signature",
        },
      };
    }

    if (code === "NOT_FOUND") {
      set.status = 404;
      return {
        error: {
          code: "ROUTE_NOT_FOUND",
          message: "Route not found",
        },
      };
    }

    if (code === "INVALID_FILE_TYPE") {
      set.status = 415;
      return {
        error: {
          code: "INVALID_FILE_TYPE",
          message: "Invalid file type",
        },
      };
    }

    // Unhandled — observability logs the original Error and stack once.
    set.status = 500;
    return {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred. Please try again later.",
      },
    };
  })
  // Register after the AtlasMed handler so its global hook observes framework
  // errors first while this app-level handler retains control of the envelope.
  .use(httpExceptionPlugin())
  // Configure CORS for frontend access
  .use(
    cors({
      origin: [...configuredCorsOrigins, firebaseHostingOrigins],
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-AtlasMed-Vertical-Id",
        "Idempotency-Key",
      ],
      exposeHeaders: ["Content-Type", "Authorization"],
      maxAge: 86400, // 24 hours
    }),
  )
  .use(
    openapi({
      documentation: apiDocumentation as any,
    }),
  )
  // Add Swagger UI (conditionally)
  .use(environment.ENABLE_SWAGGER ? swagger() : new Elysia())

  // Health checks (no version prefix)
  .use(healthRoute)

  // Versioned API routes
  // auditMiddleware is applied first in the group so its onAfterHandle runs
  // for all authenticated routes within this group.
  .group("/api/v1", (app) =>
    app
      .use(auditMiddleware)
      .use(sessions)
      .use(profileUser)
      .use(access)
      .use(avatarUser)
      .use(facility)
      .use(person)
      .use(fieldSuggestions)
      .use(catalog)
      .use(searchSync)
  .use(schedules)
      .use(territory)
      .use(maps)
      .use(orders)
      .use(potential)
      .use(visits)
      .use(dashboard)
      .use(calendar)
      .use(interactions),
  );

export default app;
