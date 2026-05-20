import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import { SpanStatusCode, trace } from '@opentelemetry/api'
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor
} from '@opentelemetry/sdk-trace-base'
import { OpenTelemetryTracer } from './open-telemetry-tracer'

describe('OpenTelemetryTracer', () => {
  let exporter: InMemorySpanExporter
  let provider: BasicTracerProvider

  beforeAll(() => {
    exporter = new InMemorySpanExporter()
    provider = new BasicTracerProvider()
    provider.addSpanProcessor(new SimpleSpanProcessor(exporter))
    trace.setGlobalTracerProvider(provider)
  })

  afterAll(async () => {
    await provider.shutdown()
  })

  beforeEach(() => {
    exporter.reset()
  })

  it('start and end produce a span with name, attributes and instrumentation scope', () => {
    const tracer = new OpenTelemetryTracer('matching', '2.0.0')
    const span = tracer.start('match-order', { marketId: 'm1', ok: true })
    tracer.end(span)
    const spans = exporter.getFinishedSpans()
    expect(spans).toHaveLength(1)
    expect(spans[0].name).toBe('match-order')
    expect(spans[0].attributes.marketId).toBe('m1')
    expect(spans[0].attributes.ok).toBe(true)
    expect(spans[0].instrumentationLibrary.name).toBe('matching')
    expect(spans[0].instrumentationLibrary.version).toBe('2.0.0')
  })

  it('skips null and undefined attribute values on start', () => {
    const tracer = new OpenTelemetryTracer('svc')
    const span = tracer.start('x', { a: '1', b: undefined, c: null })
    span.end()
    const attrs = exporter.getFinishedSpans()[0].attributes
    expect(attrs.a).toBe('1')
    expect(attrs.b).toBeUndefined()
    expect(attrs.c).toBeUndefined()
  })

  it('with resolves async callback and sets ok status', async () => {
    const tracer = new OpenTelemetryTracer('svc')
    const out = await tracer.with('op', async () => 'ok', { k: 'v' })
    expect(out).toBe('ok')
    const spans = exporter.getFinishedSpans()
    expect(spans).toHaveLength(1)
    expect(spans[0].status.code).toBe(SpanStatusCode.OK)
    expect(spans[0].attributes.k).toBe('v')
  })

  it('with wraps synchronous callback', async () => {
    const tracer = new OpenTelemetryTracer('svc')
    const out = await tracer.with('op', () => 42)
    expect(out).toBe(42)
    expect(exporter.getFinishedSpans()[0].status.code).toBe(SpanStatusCode.OK)
  })

  it('with propagates errors and marks span as error', async () => {
    const tracer = new OpenTelemetryTracer('svc')
    await expect(
      tracer.with('op', async () => {
        throw new Error('nope')
      })
    ).rejects.toThrow('nope')
    const spans = exporter.getFinishedSpans()
    expect(spans).toHaveLength(1)
    expect(spans[0].status.code).toBe(SpanStatusCode.ERROR)
    expect(spans[0].status.message).toBe('nope')
  })
})
