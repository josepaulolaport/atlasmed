import type { ReactElement } from "react";

import { environment } from "../../../../app/config/environment";

import { resend } from "../../../../infrastructure/external-services/resend/resend.client";
import { logger } from "../../../../infrastructure/logging/logger";
import { InviteEmail } from "./templates/invite.email";

export async function sendInviteEmail(
  to: string,
  token: string,
  options?: {
    invitedByName?: string;
    roleName?: string;
    inviteUrl?: string;
  },
): Promise<void> {
  if (!resend) {
    logger.warn("Resend client not initialized — skipping email send");
    return;
  }

  if (!environment.RESEND_FROM_EMAIL) {
    logger.error("RESEND_FROM_EMAIL is not set — cannot send invite email");
    return;
  }

  try {
    logger.info("Sending invite email", { to });
    const result = await resend.emails.send({
      from: environment.RESEND_FROM_EMAIL,
      to,
      subject: "You've been invited to join AtlasMed",
      react: InviteEmail({
        token,
        inviteUrl: options?.inviteUrl,
        invitedByName: options?.invitedByName,
        roleName: options?.roleName,
      }) as ReactElement,
    });

    if (result.error) {
      logger.error("Failed to send invite email", result.error);
      return;
    }

    logger.info("Invite email sent", { messageId: result.data?.id, to });
  } catch (error) {
    logger.error("Failed to send invite email", error);
  }
}
