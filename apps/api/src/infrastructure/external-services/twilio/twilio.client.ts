import twilio from 'twilio'

import { environment } from '../../../app/config/environment'

export const twilioClient =
  environment.TWILIO_ACCOUNT_SID && environment.TWILIO_AUTH_TOKEN
    ? twilio(environment.TWILIO_ACCOUNT_SID, environment.TWILIO_AUTH_TOKEN)
    : null
