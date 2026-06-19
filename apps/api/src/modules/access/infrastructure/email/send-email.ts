import type { ReactElement } from "react";

import { apiEnv } from "@atlasmed/config";

import { resend } from "../../../../infrastructure/external-services/resend/resend.client";
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
    console.warn("⚠️  Resend client not initialized. Skipping email send.");
    console.warn("   Set RESEND_API_KEY in your .env file");
    return;
  }

  if (!apiEnv.RESEND_FROM_EMAIL) {
    console.error("❌ RESEND_FROM_EMAIL is not set. Cannot send invite email.");
    console.error("   Add RESEND_FROM_EMAIL to apps/api/.env (e.g. onboarding@resend.dev for testing)");
    return;
  }

  try {
    console.log(`📧 Sending invite email to ${to}...`);
    const result = await resend.emails.send({
      from: apiEnv.RESEND_FROM_EMAIL,
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
      console.error("❌ Failed to send invite email:", result.error);
      return;
    }

    console.log(`✅ Invite email sent successfully! ID: ${result.data?.id}`);
  } catch (error) {
    console.error("❌ Failed to send invite email:", error);
  }
}
