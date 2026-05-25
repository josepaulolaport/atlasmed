import { apiEnv } from "@atlasmed/config";

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
  if (!twilioClient) {
    console.warn("Twilio client not initialized. Skipping WhatsApp message send.");
    return;
  }

  try {
    const message = createInviteMessage(token, options);

    await twilioClient.messages.create({
      from: apiEnv.TWILIO_WHATSAPP_FROM!,
      to: `whatsapp:${to}`,
      body: message,
    });
  } catch (error) {
    console.error("Failed to send invite WhatsApp message:", error);
    throw new Error("Failed to send invite WhatsApp message");
  }
}

export async function sendPasswordResetWhatsApp(to: string, token: string): Promise<void> {
  if (!twilioClient) {
    console.warn("Twilio client not initialized. Skipping WhatsApp message send.");
    return;
  }

  try {
    const message = createPasswordResetMessage(token);

    await twilioClient.messages.create({
      from: apiEnv.TWILIO_WHATSAPP_FROM!,
      to: `whatsapp:${to}`,
      body: message,
    });
  } catch (error) {
    console.error("Failed to send password reset WhatsApp message:", error);
    throw new Error("Failed to send password reset WhatsApp message");
  }
}
