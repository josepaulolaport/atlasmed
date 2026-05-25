import { Elysia } from "elysia";
import { authMiddleware } from "../middleware/auth.middleware";

export const profileRoute = new Elysia({ prefix: "/access" })
  .use(authMiddleware)
  .get("/me", async ({ auth }: any) => {
    // User info comes from the verified JWT token
    // No way to request another user's profile - always returns the authenticated user
    return {
      user: auth.user,
    };
  });
