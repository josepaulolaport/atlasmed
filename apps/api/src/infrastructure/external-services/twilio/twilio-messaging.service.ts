import { apiEnv } from "@atlasmed/config";

import type {
  MessagingService,
  SendMessageParams,
} from "../../../modules/access/application/interfaces/messaging.service.interface";

import { twilioClient } from "./twilio.client";
import { logger } from "../../logging/logger";
import { ExternalServiceError } from "../../../shared/errors";

export class TwilioMessagingService implements MessagingService {
  async send(params: SendMessageParams): Promise<void> {
    if (!twilioClient) {
      logger.warn("Twilio client not initialized — skipping WhatsApp message send");
      return;
    }

    try {
      await twilioClient.messages.create({
        from: apiEnv.TWILIO_WHATSAPP_FROM!,
        to: `whatsapp:${params.to}`,
        body: params.message,
      });
    } catch (error) {
      throw new ExternalServiceError("Twilio", error instanceof Error ? error : undefined);
    }
  }
}
