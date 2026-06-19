import { apiEnv } from "@atlasmed/config";

import type {
  MessagingService,
  SendMessageParams,
} from "../../../modules/access/application/interfaces/messaging.service.interface";

import { twilioClient } from "./twilio.client";

export class TwilioMessagingService implements MessagingService {
  async send(params: SendMessageParams): Promise<void> {
    if (!twilioClient) {
      console.warn("Twilio client not initialized. Skipping WhatsApp message send.");
      return;
    }

    try {
      await twilioClient.messages.create({
        from: apiEnv.TWILIO_WHATSAPP_FROM!,
        to: `whatsapp:${params.to}`,
        body: params.message,
      });
    } catch (error) {
      console.error("Failed to send WhatsApp message:", error);
      throw new Error("Failed to send WhatsApp message");
    }
  }
}
