import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { openapi } from "@elysiajs/openapi";
import { swagger } from "@elysiajs/swagger";
import { healthRoute } from "../infrastructure/health/health.route";
import { access } from "../modules/access";
import { clinic } from "../modules/clinic";
import { doctor } from "../modules/doctor";
import { registryIngestion } from "../modules/registry-ingestion";
import { HttpError } from "@atlasmed/access";
import { AppError } from "../shared/errors";
import { environment } from "./config/environment";
import { observabilityPlugin } from "../infrastructure/plugins/observability.plugin";
import { securityHeadersPlugin } from "../infrastructure/middleware/security-headers.middleware";
import { API_VERSION } from "./versioning";
import { apiDocumentation } from "./documentation";

const app = new Elysia()
  // Observability MUST come first to track all requests
  .use(observabilityPlugin)
  .use(securityHeadersPlugin)
  
  // Apply global error handler
  .onError(({ code, error, set, request }) => {
    const path = new URL(request.url).pathname;
    const method = request.method;
    
    // Log error with context
    console.error("[ErrorHandler]", {
      code,
      error: error instanceof Error ? error.message : String(error),
      errorType: error?.constructor?.name,
      path,
      method,
      timestamp: new Date().toISOString(),
      ...(error instanceof AppError && { errorCode: error.code }),
      ...(error instanceof HttpError && {
        errorCode: error.code,
        statusCode: error.statusCode,
      }),
    });

    // Handle custom AppError instances
    if (error instanceof AppError) {
      set.status = error.statusCode;
      return {
        error: error.toClientJSON()
      };
    }

    // Handle shared HttpError instances (auth plugin, permission middleware, etc.)
    if (error instanceof HttpError) {
      set.status = error.statusCode;
      return {
        error: error.toJSON()
      };
    }

    // Handle Zod validation errors
    if (code === "VALIDATION") {
      set.status = 400;
      return {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: error instanceof Error ? error.message : String(error)
        }
      };
    }

    // Handle unknown errors with proper logging
    set.status = 500;
    
    // Log full error details in development
    if (environment.NODE_ENV === 'development') {
      console.error("[ErrorHandler] Full error:", error);
    }
    
    return {
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: environment.NODE_ENV === 'development'
          ? (error instanceof Error ? error.message : String(error))
          : 'An unexpected error occurred. Please try again later.'
      }
    };
  })
  // Configure CORS for frontend access
  .use(
    cors({
      origin: environment.CORS_ORIGINS.split(',').map(o => o.trim()),
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
  .group('/api/v1', (app) =>
    app.use(access).use(clinic).use(doctor).use(registryIngestion)
  );

export default app;
