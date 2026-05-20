import { type Span, SpanStatusCode, trace } from '@opentelemetry/api'
import type { TraceAttributes, Tracer, TraceSpan } from './tracer'

function applyAttributes(span: Span, attributes?: TraceAttributes): void {
  if (!attributes) return
  for (const [key, value] of Object.entries(attributes)) {
    if (value === undefined || value === null) continue
    span.setAttribute(key, value)
  }
}

class OpenTelemetryTraceSpan implements TraceSpan {
  constructor(private readonly span: Span) {}

  end(): void {
    this.span.end()
  }
}

export class OpenTelemetryTracer implements Tracer {
  constructor(
    private readonly scope: string,
    private readonly version: string = '0.1.0'
  ) {}

  start(name: string, attributes?: TraceAttributes): TraceSpan {
    const tracer = trace.getTracer(this.scope, this.version)
    const otSpan = tracer.startSpan(name)
    applyAttributes(otSpan, attributes)
    return new OpenTelemetryTraceSpan(otSpan)
  }

  end(span: TraceSpan): void {
    span.end()
  }

  with<T>(name: string, fn: (span: TraceSpan) => T, attributes?: TraceAttributes): T
  with<T>(
    name: string,
    fn: (span: TraceSpan) => Promise<T>,
    attributes?: TraceAttributes
  ): Promise<T>
  with<T>(
    name: string,
    fn: (span: TraceSpan) => Promise<T> | T,
    attributes?: TraceAttributes
  ): Promise<T> | T {
    const tracer = trace.getTracer(this.scope, this.version)
    return tracer.startActiveSpan(name, (otSpan) => {
      applyAttributes(otSpan, attributes)
      const wrapped = new OpenTelemetryTraceSpan(otSpan)

      try {
        const result = fn(wrapped)

        if (result instanceof Promise) {
          return result
            .then((value) => {
              otSpan.setStatus({ code: SpanStatusCode.OK })
              return value
            })
            .catch((error) => {
              otSpan.setStatus({
                code: SpanStatusCode.ERROR,
                message: error instanceof Error ? error.message : 'error'
              })
              if (error instanceof Error) otSpan.recordException(error)
              throw error
            })
            .finally(() => {
              otSpan.end()
            })
        }

        otSpan.setStatus({ code: SpanStatusCode.OK })
        otSpan.end()
        return result
      } catch (error) {
        otSpan.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : 'error'
        })
        if (error instanceof Error) otSpan.recordException(error)
        otSpan.end()
        throw error
      }
    })
  }
}
