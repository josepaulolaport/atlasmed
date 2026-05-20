import { context as otContext } from '@opentelemetry/api'
import { type LogAttributes, logs, SeverityNumber } from '@opentelemetry/api-logs'
import type { LoggerContext, ObservabilityLogger } from './logger'

function toAttributes(context?: LoggerContext, error?: unknown): LogAttributes | undefined {
  const out: LogAttributes = {}
  let has = false
  if (context) {
    for (const [k, v] of Object.entries(context)) {
      if (v === undefined) continue
      out[k] = v
      has = true
    }
  }
  if (error instanceof Error) {
    out['exception.type'] = error.name
    out['exception.message'] = error.message
    if (error.stack) out['exception.stacktrace'] = error.stack
    has = true
  } else if (error !== undefined && error !== null) {
    out['exception.message'] = String(error)
    has = true
  }
  return has ? out : undefined
}

export class OpenTelemetryLogger implements ObservabilityLogger {
  constructor(
    private readonly scope: string,
    private readonly version: string = '0.0.0'
  ) {}

  private emit(
    severityNumber: SeverityNumber,
    severityText: string,
    body: string,
    context?: LoggerContext,
    error?: unknown
  ): void {
    const attributes = toAttributes(context, error)
    logs.getLogger(this.scope, this.version).emit({
      severityNumber,
      severityText,
      body,
      attributes,
      context: otContext.active()
    })
  }

  trace(message: string, context?: LoggerContext): void {
    this.emit(SeverityNumber.TRACE, 'trace', message, context)
  }

  debug(message: string, context?: LoggerContext): void {
    this.emit(SeverityNumber.DEBUG, 'debug', message, context)
  }

  info(message: string, context?: LoggerContext): void {
    this.emit(SeverityNumber.INFO, 'info', message, context)
  }

  warn(message: string, context?: LoggerContext): void {
    this.emit(SeverityNumber.WARN, 'warn', message, context)
  }

  error(message: string, err?: unknown, context?: LoggerContext): void {
    this.emit(SeverityNumber.ERROR, 'error', message, context, err)
  }

  fatal(message: string, err?: unknown, context?: LoggerContext): void {
    this.emit(SeverityNumber.FATAL, 'fatal', message, context, err)
  }
}
