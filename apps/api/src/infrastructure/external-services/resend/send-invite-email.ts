import type { ReactElement } from "react";

import { environment } from "../../../app/config/environment";

import { resend } from "./resend.client";
import { logger } from "../../logging/logger";
import { InviteEmail } from "./templates/invite.email";
import { PasswordResetEmail } from "./templates/password-reset.email";
import { ExternalServiceError } from "../../../shared/errors";

export async function sendInviteEmail(
  to: string,
  token: string,
  options?: {
    invitedByName?: string;
    roleName?: string;
    inviteUrl?: string;
  }
): Promise<void> {
  if (!resend) {
    logger.warn("Resend client not initialized — skipping email send");
    return;
  }

  try {
    await resend.emails.send({
      from: environment.RESEND_FROM_EMAIL!,
      to,
      subject: "You've been invited to join AtlasMed",
      react: InviteEmail({
        token,
        inviteUrl: options?.inviteUrl,
        invitedByName: options?.invitedByName,
        roleName: options?.roleName,
      }) as ReactElement,
    });
  } catch (error) {
    throw new ExternalServiceError("Resend (invite email)", error instanceof Error ? error : undefined);
  }
}

export async function sendPasswordResetEmail(
  to: string,
  token: string,
  options?: {
    resetUrl?: string;
  }
): Promise<void> {
  if (!resend) {
    logger.warn("Resend client not initialized — skipping email send");
    return;
  }

  try {
    await resend.emails.send({
      from: environment.RESEND_FROM_EMAIL!,
      to,
      subject: "Reset your password",
      react: PasswordResetEmail({
        token,
        resetUrl: options?.resetUrl,
      }) as ReactElement,
    });
  } catch (error) {
    throw new ExternalServiceError("Resend (password reset email)", error instanceof Error ? error : undefined);
  }
}
