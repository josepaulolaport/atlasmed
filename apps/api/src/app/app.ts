import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { openapi } from "@elysiajs/openapi";
import { swagger } from "@elysiajs/swagger";
import { healthRoute } from "../infrastructure/health/health.route";
import { access, user as profileUser } from "../modules/access";
import { sessions } from "../modules/sessions";
import { facility } from "../modules/facility";
import { catalog } from "../modules/catalog";
import { professional } from "../modules/professional";
import { registryIngestion } from "../modules/registry-ingestion";
import { territory } from "../modules/territory";
import { maps } from "../modules/maps";
import { orders } from "../modules/orders";
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

    // Handle Zod validation errors
    if (code === "VALIDATION") {
      set.status = 400;
      return {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request data",
          details: error instanceof Error ? error.message : String(error),
        },
      };
    }

    // Unhandled — observability plugin logs this as a 500
    set.status = 500;
    return {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message:
          environment.NODE_ENV === "development"
            ? error instanceof Error
              ? error.message
              : String(error)
            : "An unexpected error occurred. Please try again later.",
      },
    };
  })
  // Configure CORS for frontend access
  .use(
    cors({
      origin: [...configuredCorsOrigins, firebaseHostingOrigins],
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
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
      .use(catalog)
      .use(professional)
      .use(registryIngestion)
      .use(territory)
      .use(maps)
      .use(orders)
      .use(interactions),
  );

export default app;
