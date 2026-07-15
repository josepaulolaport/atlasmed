import { environment } from '@atlasmed/config'
import type { LoggerContext, ObservabilityLogger } from './logger'

function usePrettyConsole(): boolean {
  return environment.NODE_ENV !== 'production' && environment.LOG_FORMAT !== 'json'
}

const LEVEL_LABELS: Record<string, string> = {
  trace: 'TRACE',
  debug: 'DEBUG',
  info: ' INFO',
  warn: ' WARN',
  error: 'ERROR',
  fatal: 'FATAL'
}

function formatTimestamp(): string {
  const now = new Date()
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')
  const ms = String(now.getMilliseconds()).padStart(3, '0')
  return `${hh}:${mm}:${ss}.${ms}`
}

function formatContext(context: LoggerContext): string {
  return Object.entries(context)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${v}`)
    .join('  ')
}

function formatPrettyLine(
  level: string,
  scope: string,
  message: string,
  context?: LoggerContext,
  error?: unknown
): string {
  const label = LEVEL_LABELS[level] ?? level.toUpperCase()
  const time = formatTimestamp()
  const parts = [`${time} [${label}] ${scope}  ${message}`]

  if (context && Object.keys(context).length > 0) {
    parts.push(formatContext(context))
  }

  if (error instanceof Error) {
    const errorLine = error.stack
      ? `${error.name}: ${error.message}\n${error.stack.split('\n').slice(1).join('\n')}`
      : `${error.name}: ${error.message}`
    parts.push(errorLine)
  } else if (error !== undefined && error !== null) {
    parts.push(String(error))
  }

  return parts.join('  ')
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
    ...context
  }

  if (error instanceof Error) {
    payload.error = {
      name: error.name,
      message: error.message,
      stack: error.stack
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
