export type LoggerContext = Record<string, string | number | boolean | undefined>

export interface ObservabilityLogger {
  trace(message: string, context?: LoggerContext): void
  debug(message: string, context?: LoggerContext): void
  info(message: string, context?: LoggerContext): void
  warn(message: string, context?: LoggerContext): void
  error(message: string, err?: unknown, context?: LoggerContext): void
  fatal(message: string, err?: unknown, context?: LoggerContext): void
}
