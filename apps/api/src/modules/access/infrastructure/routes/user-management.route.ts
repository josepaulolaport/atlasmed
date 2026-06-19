import { Elysia, t } from "elysia";
import { changeUserRoleSchema } from "@atlasmed/access";
import { accessUseCases, auth } from "../../composition";
import { requirePermission } from "../middleware/permission.middleware";
import { ForbiddenError } from "../../../../shared/errors";

export const adminUserManagementRoute = new Elysia()
  .use(auth)
  .use(requirePermission("manage", "USER"))
  .post("/users/:id/activate", async ({ params, getUserId }: any) => {
    const userId = await getUserId();

    if (params.id === userId) {
      throw new ForbiddenError("You cannot activate your own account");
    }

    await accessUseCases.activateUser().execute({
      userId: params.id,
      activatedBy: userId,
    });

    return {
      message: "User activated successfully",
    };
  })
  .patch("/users/:id/role", async ({ params, body, getUserId }: any) => {
    const userId = await getUserId();

    if (params.id === userId) {
      throw new ForbiddenError("You cannot change your own role");
    }

    const parsed = changeUserRoleSchema.parse(body);

    await accessUseCases.changeUserRole().execute({
      targetUserId: params.id,
      newRoleId: parsed.roleId,
      changedBy: userId,
    });

    return {
      message: "User role updated successfully",
    };
  }, {
    body: t.Object({
      roleId: t.String({ description: "Role ID to assign to the user" }),
    }),
  });

export const scopedUserManagementRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "USER"))
  .post("/users/:id/deactivate", async (context: any) => {
    const { params } = context;

    if (params.id === (await context.getUserId())) {
      throw new ForbiddenError("You cannot deactivate your own account");
    }

    const actorId = await context.getUserId();
    const actor = await context.getUser();
    const scope = await context.getScope();

    await accessUseCases.deactivateUser().execute({
      userId: params.id,
      deactivatedBy: actorId,
      actorRole: actor.role.name,
      scope,
    });

    return {
      message: "User deactivated successfully",
    };
  })
  .post("/users/:id/suspend", async (context: any) => {
    const { params, body } = context;

    if (params.id === (await context.getUserId())) {
      throw new ForbiddenError("You cannot suspend your own account");
    }

    const actorId = await context.getUserId();
    const actor = await context.getUser();
    const scope = await context.getScope();

    await accessUseCases.suspendUser().execute({
      userId: params.id,
      suspendedBy: actorId,
      actorRole: actor.role.name,
      scope,
      reason: body?.reason,
    });

    return {
      message: "User suspended successfully",
    };
  }, {
    body: t.Optional(t.Object({
      reason: t.Optional(t.String()),
    })),
  })
  .post("/users/:id/unsuspend", async (context: any) => {
    const { params } = context;

    if (params.id === (await context.getUserId())) {
      throw new ForbiddenError("You cannot unsuspend your own account");
    }

    const actorId = await context.getUserId();
    const actor = await context.getUser();
    const scope = await context.getScope();

    await accessUseCases.unsuspendUser().execute({
      userId: params.id,
      unsuspendedBy: actorId,
      actorRole: actor.role.name,
      scope,
    });

    return {
      message: "User unsuspended successfully",
    };
  });

export const userManagementRoute = new Elysia()
  .use(adminUserManagementRoute)
  .use(scopedUserManagementRoute);
