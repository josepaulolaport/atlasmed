import type { ReactElement } from "react";

import { apiEnv } from "@atlasmed/config";

import { resend } from "./resend.client";
import { InviteEmail } from "./templates/invite.email";
import { PasswordResetEmail } from "./templates/password-reset.email";

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
    console.warn("Resend client not initialized. Skipping email send.");
    return;
  }

  try {
    await resend.emails.send({
      from: apiEnv.RESEND_FROM_EMAIL!,
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
    console.error("Failed to send invite email:", error);
    throw new Error("Failed to send invite email");
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
    console.warn("Resend client not initialized. Skipping email send.");
    return;
  }

  try {
    await resend.emails.send({
      from: apiEnv.RESEND_FROM_EMAIL!,
      to,
      subject: "Reset your password",
      react: PasswordResetEmail({
        token,
        resetUrl: options?.resetUrl,
      }) as ReactElement,
    });
  } catch (error) {
    console.error("Failed to send password reset email:", error);
    throw new Error("Failed to send password reset email");
  }
}
