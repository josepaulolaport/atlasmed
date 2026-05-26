import { apiEnvSchema } from "./api-env.schema";

/**
 * Normalize env vars from the API's TypeBox schema names
 * into the legacy @atlasmed/config shape.
 */
function normalizeApiEnv(env: NodeJS.ProcessEnv) {
  return {
    ...env,
    JWT_SECRET: env.JWT_SECRET ?? env.JWT_ACCESS_SECRET,
    JWT_EXPIRES_IN: env.JWT_EXPIRES_IN ?? env.JWT_EXPIRATION,
    TWILIO_WHATSAPP_FROM: env.TWILIO_WHATSAPP_FROM ?? env.TWILIO_WHATSAPP_NUMBER,
  };
}

export const apiEnv = apiEnvSchema.parse(normalizeApiEnv(process.env));