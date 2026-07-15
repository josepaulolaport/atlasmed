import { Resend } from 'resend'

import { environment } from '../../../app/config/environment'

export const resend = environment.RESEND_API_KEY ? new Resend(environment.RESEND_API_KEY) : null
