import { Resend } from "resend";

import { apiEnv } from "@atlasmed/config";

export const resend = apiEnv.RESEND_API_KEY ? new Resend(apiEnv.RESEND_API_KEY) : null;
