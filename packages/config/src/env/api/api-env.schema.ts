import { z } from "zod";

const booleanFromEnv = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0") return false;
  }

  return value;
}, z.boolean().optional());

export const apiEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),

  PORT: z.coerce.number(),

  DATABASE_URL: z.string(),

  REDIS_URL: z.string(),

  // Legacy names kept for @atlasmed/config consumers
  JWT_SECRET: z.string(),

  JWT_EXPIRES_IN: z.string(),

  RESEND_API_KEY: z.string().optional(),

  RESEND_FROM_EMAIL: z.string().optional(),

  TWILIO_ACCOUNT_SID: z.string().optional(),

  TWILIO_AUTH_TOKEN: z.string().optional(),

  TWILIO_WHATSAPP_FROM: z.string().optional(),

  QUESTDB_ENABLED: booleanFromEnv,

  QUESTDB_HOST: z.string().optional(),

  QUESTDB_PORT: z.coerce.number().optional(),
});
