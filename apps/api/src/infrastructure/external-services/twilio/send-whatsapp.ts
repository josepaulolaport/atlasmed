import { environment } from "../../../app/config/environment";
import { logger } from "../../logging/logger";
import { ExternalServiceError } from "../../../shared/errors";

import { twilioClient } from "./twilio.client";
import { createInviteMessage, createPasswordResetMessage } from "./templates/message.templates";

export async function sendInviteWhatsApp(
  to: string,
  token: string,
  options?: {
    invitedByName?: string;
    roleName?: string;
  }
): Promise<void> {
  // Align with invite email test harness: skip delivery under test credentials.
  const isTestRuntime =
    process.env.NODE_ENV === "test" ||
    environment.RESEND_API_KEY === "re_test_key";

  if (!twilioClient || !environment.TWILIO_WHATSAPP_NUMBER) {
    if (isTestRuntime) {
      logger.info("Skipping invite WhatsApp (test runtime / Twilio unset)", { to });
      return;
    }
    throw new ExternalServiceError("Twilio (invite WhatsApp)");
  }

  try {
    const message = createInviteMessage(token, options);

    logger.info("Sending invite WhatsApp message", { to });
    const result = await twilioClient.messages.create({
      from: environment.TWILIO_WHATSAPP_NUMBER,
      to: `whatsapp:${to}`,
      body: message,
    });
    logger.info("WhatsApp message sent", { sid: result.sid, to });
  } catch (error) {
    if (error instanceof ExternalServiceError) throw error;
    logger.error("Failed to send invite WhatsApp message", error);
    throw new ExternalServiceError(
      "Twilio (invite WhatsApp)",
      error instanceof Error ? error : undefined,
    );
  }
}

export async function sendPasswordResetWhatsApp(to: string, token: string): Promise<void> {
  if (!twilioClient) {
    logger.warn("Twilio client not initialized — skipping WhatsApp message send");
    return;
  }

  try {
    const message = createPasswordResetMessage(token);

    logger.info("Sending password reset WhatsApp message", { to });
    const result = await twilioClient.messages.create({
      from: environment.TWILIO_WHATSAPP_NUMBER!,
      to: `whatsapp:${to}`,
      body: message,
    });
    logger.info("WhatsApp message sent", { sid: result.sid, to });
  } catch (error) {
    logger.error("Failed to send password reset WhatsApp message", error);
  }
}
