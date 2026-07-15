import { environment } from '../../../app/config/environment'
import { logger } from '../../logging/logger'
import { createInviteMessage, createPasswordResetMessage } from './templates/message.templates'
import { twilioClient } from './twilio.client'

export async function sendInviteWhatsApp(
  to: string,
  token: string,
  options?: {
    invitedByName?: string
    roleName?: string
  }
): Promise<void> {
  if (!twilioClient) {
    logger.warn('Twilio client not initialized — skipping WhatsApp message send')
    return
  }

  try {
    const message = createInviteMessage(token, options)

    logger.info('Sending invite WhatsApp message', { to })
    const result = await twilioClient.messages.create({
      from: environment.TWILIO_WHATSAPP_NUMBER!,
      to: `whatsapp:${to}`,
      body: message
    })
    logger.info('WhatsApp message sent', { sid: result.sid, to })
  } catch (error) {
    logger.error('Failed to send invite WhatsApp message', error)
    // Don't throw - we don't want to block invitation creation if WhatsApp fails
  }
}

export async function sendPasswordResetWhatsApp(to: string, token: string): Promise<void> {
  if (!twilioClient) {
    logger.warn('Twilio client not initialized — skipping WhatsApp message send')
    return
  }

  try {
    const message = createPasswordResetMessage(token)

    logger.info('Sending password reset WhatsApp message', { to })
    const result = await twilioClient.messages.create({
      from: environment.TWILIO_WHATSAPP_NUMBER!,
      to: `whatsapp:${to}`,
      body: message
    })
    logger.info('WhatsApp message sent', { sid: result.sid, to })
  } catch (error) {
    logger.error('Failed to send password reset WhatsApp message', error)
    // Don't throw - we don't want to block password reset if WhatsApp fails
  }
}
