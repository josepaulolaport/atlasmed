export function createInviteMessage(token: string, options?: { invitedByName?: string; roleName?: string }): string {
  const greeting = options?.invitedByName
    ? `${options.invitedByName} has invited you to join AtlasMed`
    : "You've been invited to join AtlasMed";

  const role = options?.roleName ? ` as a ${options.roleName}` : "";

  return `🎉 ${greeting}${role}!\n\nYour invitation code is: *${token}*\n\nThis invitation expires in 7 days.\n\n_AtlasMed - Healthcare Management System_`;
}

export function createPasswordResetMessage(token: string): string {
  return `🔐 Password Reset Request\n\nYour password reset code is: *${token}*\n\nThis code expires in 1 hour.\n\nIf you didn't request this, please ignore this message.\n\n_AtlasMed - Healthcare Management System_`;
}
