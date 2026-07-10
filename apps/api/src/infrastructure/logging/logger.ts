/**
 * Application logger — Pino-compatible API backed by @atlasmed/observability.
 * Always writes to the console; also ships to SigNoz when OTEL log endpoints are set.
 */

import {
  createLogger,
  type LoggerContext,
  type ObservabilityLogger,
} from "@atlasmed/observability";

const baseLogger = createLogger("api");

type LogContext = Record<string, unknown>;

function toLoggerContext(context?: LogContext): LoggerContext | undefined {
  if (!context) return undefined;

  const out: LoggerContext = {};
  for (const [key, value] of Object.entries(context)) {
    if (value === undefined) continue;
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      out[key] = value;
      continue;
    }
    out[key] = String(value);
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function normalizeArgs(
  arg1: string | LogContext,
  arg2?: string | LogContext
): { message: string; context?: LogContext } {
  if (typeof arg1 === "string") {
    return {
      message: arg1,
      context: typeof arg2 === "object" ? arg2 : undefined,
    };
  }

  return {
    message: typeof arg2 === "string" ? arg2 : "log",
    context: arg1,
  };
}

function wrapLogger(logger: ObservabilityLogger) {
  return {
    trace(arg1: string | LogContext, arg2?: string | LogContext) {
      const { message, context } = normalizeArgs(arg1, arg2);
      logger.trace(message, toLoggerContext(context));
    },
    debug(arg1: string | LogContext, arg2?: string | LogContext) {
      const { message, context } = normalizeArgs(arg1, arg2);
      logger.debug(message, toLoggerContext(context));
    },
    info(arg1: string | LogContext, arg2?: string | LogContext) {
      const { message, context } = normalizeArgs(arg1, arg2);
      logger.info(message, toLoggerContext(context));
    },
    warn(arg1: string | LogContext, arg2?: string | LogContext) {
      const { message, context } = normalizeArgs(arg1, arg2);
      logger.warn(message, toLoggerContext(context));
    },
    error(arg1: string | LogContext, arg2?: unknown, arg3?: LogContext) {
      if (typeof arg1 === "object" && !(arg1 instanceof Error) && typeof arg2 === "string") {
        logger.error(arg2, undefined, toLoggerContext(arg1));
        return;
      }
      if (typeof arg1 === "string") {
        const err = arg2 instanceof Error ? arg2 : undefined;
        const context =
          arg3 ??
          (arg2 && typeof arg2 === "object" && !(arg2 instanceof Error)
            ? (arg2 as LogContext)
            : undefined);
        logger.error(arg1, err, toLoggerContext(context));
      }
    },
    fatal(arg1: string | LogContext, arg2?: unknown, arg3?: LogContext) {
      if (typeof arg1 === "object" && typeof arg2 === "string") {
        logger.fatal(arg2, undefined, toLoggerContext(arg1));
        return;
      }
      if (typeof arg1 === "string") {
        const err = arg2 instanceof Error ? arg2 : undefined;
        logger.fatal(arg1, err, toLoggerContext(arg3));
      }
    },
    child(context: LogContext) {
      return wrapLogger({
        trace: (message, extra) =>
          logger.trace(message, toLoggerContext({ ...context, ...extra })),
        debug: (message, extra) =>
          logger.debug(message, toLoggerContext({ ...context, ...extra })),
        info: (message, extra) =>
          logger.info(message, toLoggerContext({ ...context, ...extra })),
        warn: (message, extra) =>
          logger.warn(message, toLoggerContext({ ...context, ...extra })),
        error: (message, err, extra) =>
          logger.error(message, err, toLoggerContext({ ...context, ...extra })),
        fatal: (message, err, extra) =>
          logger.fatal(message, err, toLoggerContext({ ...context, ...extra })),
      });
    },
  };
}

export const logger = wrapLogger(baseLogger);

export function createContextLogger(context: LogContext) {
  return logger.child(context);
}

export function logWithContext(
  context: LogContext,
  level: "debug" | "info" | "warn" | "error",
  message: string,
  additionalData?: LogContext
) {
  const contextLogger = createContextLogger({ ...context, ...additionalData });
  contextLogger[level](message);
}

export function logError(error: Error | unknown, context?: LogContext) {
  const message = error instanceof Error ? error.message : "Error occurred";
  baseLogger.error(message, error instanceof Error ? error : undefined, toLoggerContext(context));
}
