import type { ReactElement } from "react";

import { environment } from "../../../../app/config/environment";

import { resend } from "../../../../infrastructure/external-services/resend/resend.client";
import { logger } from "../../../../infrastructure/logging/logger";
import { ExternalServiceError } from "../../../../shared/errors";
import { InviteEmail } from "./templates/invite.email";

/** Test harness key from `test-env-loader` — do not call Resend. */
function isTestResendKey(): boolean {
  return environment.RESEND_API_KEY === "re_test_key";
}

export async function sendInviteEmail(
  to: string,
  token: string,
  options?: {
    invitedByName?: string;
    roleName?: string;
    inviteUrl?: string;
  },
): Promise<void> {
  if (!resend || isTestResendKey()) {
    if (isTestResendKey()) {
      logger.info("Skipping invite email (test Resend key)", { to });
      return;
    }
    throw new ExternalServiceError("Resend (invite email)");
  }

  if (!environment.RESEND_FROM_EMAIL) {
    throw new ExternalServiceError("Resend (invite email — RESEND_FROM_EMAIL missing)");
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
      throw new ExternalServiceError(
        "Resend (invite email)",
        new Error(
          typeof result.error === "object" && result.error && "message" in result.error
            ? String((result.error as { message?: string }).message)
            : "Resend API error",
        ),
      );
    }

    logger.info("Invite email sent", { messageId: result.data?.id, to });
  } catch (error) {
    if (error instanceof ExternalServiceError) throw error;
    logger.error("Failed to send invite email", error);
    throw new ExternalServiceError(
      "Resend (invite email)",
      error instanceof Error ? error : undefined,
    );
  }
}
