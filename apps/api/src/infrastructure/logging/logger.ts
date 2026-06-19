/**
 * Structured Logger with Pino
 * 
 * Provides structured logging with request context and proper log levels.
 */

import pino from 'pino';
import { environment } from '../../app/config/environment';

/**
 * Create base logger instance
 */
export const logger = pino({
  level: environment.LOG_LEVEL,
  
  // Pretty print in development
  transport: environment.NODE_ENV === 'development' 
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
          singleLine: false,
          messageFormat: '{msg}',
        }
      }
    : undefined,
  
  // Format log levels
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  
  // ISO timestamps
  timestamp: pino.stdTimeFunctions.isoTime,
  
  // Base fields included in every log
  base: {
    service: environment.OTEL_SERVICE_NAME,
    environment: environment.NODE_ENV,
  },
});

/**
 * Create a child logger with additional context
 * 
 * @example
 * const reqLogger = createContextLogger({ requestId: 'req_123', userId: 'user_456' });
 * reqLogger.info('Processing request');
 */
export function createContextLogger(context: Record<string, unknown>) {
  return logger.child(context);
}

/**
 * Log with request context
 * 
 * @example
 * logWithContext({ requestId: 'req_123' }, 'info', 'Request completed');
 */
export function logWithContext(
  context: Record<string, unknown>,
  level: 'debug' | 'info' | 'warn' | 'error',
  message: string,
  additionalData?: Record<string, unknown>
) {
  const contextLogger = createContextLogger(context);
  contextLogger[level](additionalData ?? {}, message);
}

/**
 * Log an error with full context
 * 
 * @example
 * logError(error, { requestId: 'req_123', userId: 'user_456' });
 */
export function logError(
  error: Error | unknown,
  context?: Record<string, unknown>
) {
  const errorData = {
    ...context,
    error: error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : error,
  };
  
  logger.error(errorData, error instanceof Error ? error.message : 'Error occurred');
}
