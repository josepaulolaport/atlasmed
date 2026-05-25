import { Elysia } from "elysia";
import { accessUseCases } from "../../composition";
import { authMiddleware } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permission.middleware";

export const userManagementRoute = new Elysia({ prefix: "/access" })
  .use(authMiddleware)
  .use(requirePermission("manage", "USER"))
  .post("/users/:id/deactivate", async ({ params, auth }: any) => {
    // Prevent self-deactivation
    if (params.id === auth.user.id) {
      throw new Error("You cannot deactivate your own account");
    }

    await accessUseCases.deactivateUser().execute({
      userId: params.id,
    });

    return {
      message: "User deactivated successfully",
    };
  })
  .post("/users/:id/activate", async ({ params, auth }: any) => {
    // Prevent self-activation (though this shouldn't be possible if already active)
    if (params.id === auth.user.id) {
      throw new Error("You cannot activate your own account");
    }

    await accessUseCases.activateUser().execute({
      userId: params.id,
    });

    return {
      message: "User activated successfully",
    };
  });
