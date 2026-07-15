import { environment } from '../../../../app/config/environment'
import { resend } from '../../../../infrastructure/external-services/resend/resend.client'
import { sendPasswordResetWhatsApp } from '../../../../infrastructure/external-services/twilio/send-whatsapp'
import { logger } from '../../../../infrastructure/logging/logger'

interface SendPasswordChangedNotificationParams {
  email?: string | undefined
  phoneNumber?: string | undefined
  timestamp: Date
  ipAddress?: string | undefined
}

export class NotificationService {
  async sendPasswordChangedNotification(
    params: SendPasswordChangedNotificationParams
  ): Promise<void> {
    const notifications: Promise<void>[] = []

    const formattedTimestamp = params.timestamp.toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short'
    })

    const emailBody = `Your AtlasMed password was changed on ${formattedTimestamp}${
      params.ipAddress ? ` from IP ${params.ipAddress}` : ''
    }. If this was not you, contact support immediately.`

    if (params.email && resend && environment.RESEND_FROM_EMAIL) {
      notifications.push(
        resend.emails
          .send({
            from: environment.RESEND_FROM_EMAIL,
            to: params.email,
            subject: 'Your AtlasMed password was changed',
            text: emailBody
          })
          .then(() => undefined)
          .catch((error) => {
            logger.error('Failed to send password changed email', error)
          })
      )
    } else if (params.email) {
      logger.warn('Password changed email skipped — Resend not configured', {
        email: params.email
      })
    }

    if (params.phoneNumber) {
      const message = `Security Alert: Your password was changed on ${formattedTimestamp}${
        params.ipAddress ? ` from IP ${params.ipAddress}` : ''
      }. If this wasn't you, contact support immediately. - AtlasMed`

      notifications.push(
        sendPasswordResetWhatsApp(params.phoneNumber, message).catch((error) => {
          logger.error('Failed to send password changed WhatsApp', error)
        })
      )
    }

    if (notifications.length === 0) {
      console.warn('User has no contact method for password change notification')
    }

    await Promise.allSettled(notifications)
  }
}
