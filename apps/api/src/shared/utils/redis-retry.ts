export class RedisCacheError extends Error {
  readonly cause: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "RedisCacheError";
    this.cause = cause;
  }
}

export async function withRedisRetry<T>(
  operation: () => Promise<T>,
  options: {
    attempts?: number;
    delayMs?: number;
    operationName?: string;
  } = {}
): Promise<T> {
  const attempts = options.attempts ?? 3;
  const delayMs = options.delayMs ?? 50;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
      }
    }
  }

  const label = options.operationName ? `: ${options.operationName}` : "";
  throw new RedisCacheError(
    `Redis operation failed after ${attempts} attempts${label}`,
    lastError
  );
}
