import type { LoggerContext, ObservabilityLogger } from './logger'

function usePrettyConsole(): boolean {
  return (
    process.env.NODE_ENV !== 'production' &&
    process.env.LOG_FORMAT !== 'json'
  )
}

function formatPrettyLine(
  level: string,
  scope: string,
  message: string,
  context?: LoggerContext,
  error?: unknown
): string {
  const parts = [`[${level}]`, scope, message]
  if (context && Object.keys(context).length > 0) {
    parts.push(JSON.stringify(context))
  }
  if (error instanceof Error) {
    parts.push(`— ${error.message}`)
  } else if (error !== undefined && error !== null) {
    parts.push(`— ${String(error)}`)
  }
  return parts.join(' ')
}

function formatJsonLine(
  level: string,
  scope: string,
  message: string,
  context?: LoggerContext,
  error?: unknown
): string {
  const payload: Record<string, unknown> = {
    level,
    service: scope,
    msg: message,
    time: new Date().toISOString(),
    ...context,
  }

  if (error instanceof Error) {
    payload.error = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    }
  } else if (error !== undefined && error !== null) {
    payload.error = String(error)
  }

  return JSON.stringify(payload)
}

function formatLine(
  level: string,
  scope: string,
  message: string,
  context?: LoggerContext,
  error?: unknown
): string {
  return usePrettyConsole()
    ? formatPrettyLine(level, scope, message, context, error)
    : formatJsonLine(level, scope, message, context, error)
}

export class ConsoleLogger implements ObservabilityLogger {
  constructor(private readonly scope: string) {}

  trace(message: string, context?: LoggerContext): void {
    console.debug(formatLine('trace', this.scope, message, context))
  }

  debug(message: string, context?: LoggerContext): void {
    console.debug(formatLine('debug', this.scope, message, context))
  }

  info(message: string, context?: LoggerContext): void {
    console.info(formatLine('info', this.scope, message, context))
  }

  warn(message: string, context?: LoggerContext): void {
    console.warn(formatLine('warn', this.scope, message, context))
  }

  error(message: string, err?: unknown, context?: LoggerContext): void {
    console.error(formatLine('error', this.scope, message, context, err))
  }

  fatal(message: string, err?: unknown, context?: LoggerContext): void {
    console.error(formatLine('fatal', this.scope, message, context, err))
  }
}
