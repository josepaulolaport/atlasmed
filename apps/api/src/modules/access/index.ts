export { auth } from "./composition";
export * from "./infrastructure/middleware/permission.middleware";

import { Elysia } from "elysia";
import { loginRoute } from "./infrastructure/routes/login.route";
import { refreshSessionRoute } from "./infrastructure/routes/refresh-session.route";
import { logoutRoute } from "./infrastructure/routes/logout.route";
import { sessionsRoute } from "./infrastructure/routes/sessions.route";
import { acceptInviteRoute } from "./infrastructure/routes/accept-invite.route";
import { inviteUserRoute } from "./infrastructure/routes/invite-user.route";
import { revokeInviteRoute } from "./infrastructure/routes/revoke-invite.route";
import { listInvitationsRoute } from "./infrastructure/routes/list-invitations.route";
import { listUsersRoute } from "./infrastructure/routes/list-users.route";
import { userManagementRoute } from "./infrastructure/routes/user-management.route";
import { profileRoute } from "./infrastructure/routes/profile.route";
import { requestPasswordResetRoute } from "./infrastructure/routes/request-password-reset.route";
import { resetPasswordRoute } from "./infrastructure/routes/reset-password.route";
import { verificationRoute } from "./infrastructure/routes/verification.route";
import { rolesRoute } from "./infrastructure/routes/roles.route";
import { userAssignmentsRoute } from "./infrastructure/routes/user-assignments.route";
import { userPermissionsRoute } from "./infrastructure/routes/user-permissions.route";

export const access = new Elysia({
  name: "access",
  prefix: "/access",
  detail: {
    tags: ["Authentication"],
  },
})
  .use(sessionsRoute)
  .use(logoutRoute)
  .use(refreshSessionRoute)
  .use(loginRoute)
  .use(acceptInviteRoute)
  .use(inviteUserRoute)
  .use(listInvitationsRoute)
  .use(listUsersRoute)
  .use(revokeInviteRoute)
  .use(userManagementRoute)
  .use(userAssignmentsRoute)
  .use(profileRoute)
  .use(requestPasswordResetRoute)
  .use(resetPasswordRoute)
  .use(verificationRoute)
  .use(rolesRoute)
  .use(userPermissionsRoute);
