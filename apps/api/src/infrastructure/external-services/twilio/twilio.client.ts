import twilio from "twilio";

import { apiEnv } from "@atlasmed/config";

export const twilioClient =
  apiEnv.TWILIO_ACCOUNT_SID && apiEnv.TWILIO_AUTH_TOKEN
    ? twilio(apiEnv.TWILIO_ACCOUNT_SID, apiEnv.TWILIO_AUTH_TOKEN)
    : null;
