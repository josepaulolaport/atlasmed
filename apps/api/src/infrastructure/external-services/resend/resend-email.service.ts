import { environment } from '../../../app/config/environment'

import type {
  EmailService,
  SendEmailParams
} from '../../../modules/access/application/interfaces/email.service.interface'
import { ExternalServiceError } from '../../../shared/errors'
import { logger } from '../../logging/logger'
import { resend } from './resend.client'

export class ResendEmailService implements EmailService {
  async send(params: SendEmailParams): Promise<void> {
    if (!resend) {
      logger.warn('Resend client not initialized — skipping email send')
      return
    }

    try {
      await resend.emails.send({
        from: environment.RESEND_FROM_EMAIL ?? '',
        to: params.to,
        subject: params.subject,
        react: params.react
      })
    } catch (error) {
      throw new ExternalServiceError('Resend', error instanceof Error ? error : undefined)
    }
  }
}
