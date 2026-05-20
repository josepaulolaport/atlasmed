import { apiEnvSchema }
from "./api-env.schema";

export const apiEnv =
  apiEnvSchema.parse(
    process.env
  );