import { type Span, SpanStatusCode, trace } from '@opentelemetry/api'
import { logs } from '@opentelemetry/api-logs'
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { Resource } from '@opentelemetry/resources'
import { BatchLogRecordProcessor, LoggerProvider } from '@opentelemetry/sdk-logs'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions'

let sdk: NodeSDK | null = null
let loggerProvider: LoggerProvider | null = null

export function resolveLogsEndpoint(params: {
  endpoint?: string
  logsEndpoint?: string
}): string | null {
  if (params.logsEndpoint) {
    return params.logsEndpoint
  }

  if (!params.endpoint) {
    return null
  }

  if (/\/v1\/traces\/?$/.test(params.endpoint)) {
    return params.endpoint.replace(/\/v1\/traces\/?$/, '/v1/logs')
  }

  const base = params.endpoint.endsWith('/') ? params.endpoint.slice(0, -1) : params.endpoint
  return `${base}/v1/logs`
}

export function initOpenTelemetry(params: {
  serviceName: string
  endpoint?: string
  logsEndpoint?: string
  initializeTraces?: boolean
}): void {
  if (sdk || loggerProvider) return

  const resource = new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: params.serviceName
  })

  if (params.initializeTraces !== false && params.endpoint) {
    const exporter = new OTLPTraceExporter({
      url: params.endpoint
    })

    sdk = new NodeSDK({
      resource,
      traceExporter: exporter
    })

    sdk.start()
  }

  const logsUrl = resolveLogsEndpoint(params)

  if (logsUrl) {
    const logExporter = new OTLPLogExporter({ url: logsUrl })

    loggerProvider = new LoggerProvider({
      resource
    })
    loggerProvider.addLogRecordProcessor(new BatchLogRecordProcessor(logExporter))
    logs.setGlobalLoggerProvider(loggerProvider)
  }
}

export async function shutdownOpenTelemetry(): Promise<void> {
  if (sdk) {
    await sdk.shutdown()
    sdk = null
  }

  if (loggerProvider) {
    await loggerProvider.shutdown()
    loggerProvider = null
  }
}

/** @deprecated Use per-project tracer instead: `import { tracer } from './tracer'` then `tracer.with(...)` */
export function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T> | T,
  attrs?: Record<string, string | number | boolean | undefined | null>
): Promise<T> | T {
  const tracer = trace.getTracer('real-trend')
  return tracer.startActiveSpan(name, async (span) => {
    try {
      if (attrs) {
        for (const [key, value] of Object.entries(attrs)) {
          if (value === undefined || value === null) continue
          span.setAttribute(key, value)
        }
      }
      const result = await fn(span)
      span.setStatus({ code: SpanStatusCode.OK })
      return result
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'error'
      })
      if (error instanceof Error) span.recordException(error)
      throw error
    } finally {
      span.end()
    }
  })
}

/** @deprecated Use per-project tracer instead: `import { tracer } from './tracer'` then `tracer.with(...)` */
export function withSpanSync<T>(
  name: string,
  fn: () => T,
  attrs?: Record<string, string | number | boolean | undefined | null>
): T {
  const tracer = trace.getTracer('real-trend')
  return tracer.startActiveSpan(name, (span) => {
    try {
      if (attrs) {
        for (const [key, value] of Object.entries(attrs)) {
          if (value === undefined || value === null) continue
          span.setAttribute(key, value)
        }
      }
      const result = fn()
      span.setStatus({ code: SpanStatusCode.OK })
      return result
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'error'
      })
      if (error instanceof Error) span.recordException(error)
      throw error
    } finally {
      span.end()
    }
  })
}
