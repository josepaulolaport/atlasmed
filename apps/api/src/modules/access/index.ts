export { auth } from "./composition";
export * from "./infrastructure/middleware/permission.middleware";

import { Elysia } from "elysia";
import { acceptInviteRoute } from "./infrastructure/routes/accept-invite.route";
import { inviteUserRoute } from "./infrastructure/routes/invite-user.route";
import { revokeInviteRoute } from "./infrastructure/routes/revoke-invite.route";
import { resendInviteRoute } from "./infrastructure/routes/resend-invite.route";
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
import { changePasswordRoute } from "./infrastructure/routes/change-password.route";
import { capabilitiesRoute } from "./infrastructure/routes/capabilities.route";
import { sectorsRoute } from "./infrastructure/routes/sectors.route";

export const access = new Elysia({
  name: "access",
  prefix: "/access",
  detail: {
    tags: ["Authentication"],
  },
})
  .use(acceptInviteRoute)
  .use(inviteUserRoute)
  .use(listInvitationsRoute)
  .use(listUsersRoute)
  .use(revokeInviteRoute)
  .use(resendInviteRoute)
  .use(userManagementRoute)
  .use(userAssignmentsRoute)
  .use(profileRoute)
  .use(changePasswordRoute)
  .use(capabilitiesRoute)
  .use(requestPasswordResetRoute)
  .use(resetPasswordRoute)
  .use(verificationRoute)
  .use(rolesRoute)
  .use(userPermissionsRoute)
  .use(sectorsRoute);
