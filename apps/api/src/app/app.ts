import { Elysia } from "elysia";
import { openapi } from "@elysiajs/openapi";
import { swagger } from "@elysiajs/swagger";
import { errorHandler } from "../infrastructure/middleware/error-handler";
import {
  loginRoute,
  logoutRoute,
  refreshSessionRoute,
  acceptInviteRoute,
  inviteUserRoute,
  revokeInviteRoute,
  sessionsRoute,
  userManagementRoute,
  profileRoute,
  requestPasswordResetRoute,
  resetPasswordRoute,
} from "../modules/access";

const app = new Elysia()
  // Add OpenAPI specification
  .use(
    openapi({
      documentation: {
        info: {
          title: "AtlasMed API",
          version: "1.0.0",
          description: "AtlasMed healthcare platform API - Complete authentication and user management",
        },
        tags: [
          {
            name: "Authentication",
            description: "User authentication and session management endpoints",
          },
          {
            name: "Users",
            description: "User management, invitations, and profile operations",
          },
        ],
        servers: [
          {
            url: "http://localhost:3000",
            description: "Local development server",
          },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: "http",
              scheme: "bearer",
              bearerFormat: "JWT",
              description: "JWT access token obtained from login",
            },
          },
        },
      },
    })
  )
  // Add Swagger UI
  .use(swagger())
  // Apply global error handler
  .use(errorHandler)
  
  // Register all routes
  .use(loginRoute)
  .use(logoutRoute)
  .use(refreshSessionRoute)
  .use(acceptInviteRoute)
  .use(inviteUserRoute)
  .use(revokeInviteRoute)
  .use(sessionsRoute)
  .use(userManagementRoute)
  .use(profileRoute)
  .use(requestPasswordResetRoute)
  .use(resetPasswordRoute);

export default app;
