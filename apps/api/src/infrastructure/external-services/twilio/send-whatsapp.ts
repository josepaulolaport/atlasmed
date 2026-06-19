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
    console.warn("⚠️  Twilio client not initialized. Skipping WhatsApp message send.");
    console.warn("   Check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables");
    return;
  }

  try {
    const message = createInviteMessage(token, options);
    
    console.log(`📱 Sending invite WhatsApp message to ${to}...`);
    const result = await twilioClient.messages.create({
      from: apiEnv.TWILIO_WHATSAPP_FROM!,
      to: `whatsapp:${to}`,
      body: message,
    });
    console.log(`✅ WhatsApp message sent successfully! SID: ${result.sid}`);
  } catch (error) {
    console.error("❌ Failed to send invite WhatsApp message:", error);
    // Don't throw - we don't want to block invitation creation if WhatsApp fails
  }
}

export async function sendPasswordResetWhatsApp(to: string, token: string): Promise<void> {
  if (!twilioClient) {
    console.warn("⚠️  Twilio client not initialized. Skipping WhatsApp message send.");
    console.warn("   Check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables");
    return;
  }

  try {
    const message = createPasswordResetMessage(token);
    
    console.log(`📱 Sending password reset WhatsApp message to ${to}...`);
    const result = await twilioClient.messages.create({
      from: apiEnv.TWILIO_WHATSAPP_FROM!,
      to: `whatsapp:${to}`,
      body: message,
    });
    console.log(`✅ WhatsApp message sent successfully! SID: ${result.sid}`);
  } catch (error) {
    console.error("❌ Failed to send password reset WhatsApp message:", error);
    // Don't throw - we don't want to block password reset if WhatsApp fails
  }
}
