import { environment } from '../../../app/config/environment'

import type {
  MessagingService,
  SendMessageParams
} from '../../../modules/access/application/interfaces/messaging.service.interface'
import { ExternalServiceError } from '../../../shared/errors'
import { logger } from '../../logging/logger'
import { twilioClient } from './twilio.client'

export class TwilioMessagingService implements MessagingService {
  async send(params: SendMessageParams): Promise<void> {
    if (!twilioClient) {
      logger.warn('Twilio client not initialized — skipping WhatsApp message send')
      return
    }

    try {
      await twilioClient.messages.create({
        from: environment.TWILIO_WHATSAPP_NUMBER!,
        to: `whatsapp:${params.to}`,
        body: params.message
      })
    } catch (error) {
      throw new ExternalServiceError('Twilio', error instanceof Error ? error : undefined)
    }
  }
}
