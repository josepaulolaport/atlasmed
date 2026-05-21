import {z} from "zod";

const envSchema = z.object({
    PORT: z.string(),
  
    DATABASE_URL: z.string(),
  
    REDIS_URL: z.string(),
  
    JWT_EXPIRATION: z.string(),
    JWT_ACCESS_SECRET: z.string(),
    JWT_REFRESH_SECRET: z.string(),
    JWT_REFRESH_EXPIRATION: z.string(),
  
    NODE_ENV: z.enum([
      "development",
      "production",
      "test"
    ])
  });

export const env = envSchema.parse(process.env);