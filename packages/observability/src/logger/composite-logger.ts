import type { LoggerContext, ObservabilityLogger } from './logger'

export class CompositeLogger implements ObservabilityLogger {
  constructor(private readonly loggers: ObservabilityLogger[]) {}

  trace(message: string, context?: LoggerContext): void {
    for (const logger of this.loggers) logger.trace(message, context)
  }

  debug(message: string, context?: LoggerContext): void {
    for (const logger of this.loggers) logger.debug(message, context)
  }

  info(message: string, context?: LoggerContext): void {
    for (const logger of this.loggers) logger.info(message, context)
  }

  warn(message: string, context?: LoggerContext): void {
    for (const logger of this.loggers) logger.warn(message, context)
  }

  error(message: string, err?: unknown, context?: LoggerContext): void {
    for (const logger of this.loggers) logger.error(message, err, context)
  }

  fatal(message: string, err?: unknown, context?: LoggerContext): void {
    for (const logger of this.loggers) logger.fatal(message, err, context)
  }
}
