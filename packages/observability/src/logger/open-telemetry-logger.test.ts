import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import { logs, SeverityNumber } from '@opentelemetry/api-logs'
import { type ExportResult, ExportResultCode } from '@opentelemetry/core'
import type { LogRecordExporter, ReadableLogRecord } from '@opentelemetry/sdk-logs'
import { LoggerProvider, SimpleLogRecordProcessor } from '@opentelemetry/sdk-logs'
import { OpenTelemetryLogger } from './open-telemetry-logger'

class MemoryLogExporter implements LogRecordExporter {
  readonly records: ReadableLogRecord[] = []

  export(batch: ReadableLogRecord[], resultCallback: (result: ExportResult) => void): void {
    this.records.push(...batch)
    resultCallback({ code: ExportResultCode.SUCCESS })
  }

  shutdown(): Promise<void> {
    return Promise.resolve()
  }
}

describe('OpenTelemetryLogger', () => {
  let exporter: MemoryLogExporter
  let provider: LoggerProvider

  beforeAll(() => {
    exporter = new MemoryLogExporter()
    provider = new LoggerProvider()
    provider.addLogRecordProcessor(new SimpleLogRecordProcessor(exporter))
    logs.setGlobalLoggerProvider(provider)
  })

  afterAll(async () => {
    await provider.shutdown()
  })

  beforeEach(() => {
    exporter.records.length = 0
  })

  it('emits info with body, severity, attributes and instrumentation scope', () => {
    const logger = new OpenTelemetryLogger('orders', '1.0.0')
    logger.info('placed', { orderId: 'o1', count: 2 })
    expect(exporter.records).toHaveLength(1)
    const r = exporter.records[0]
    expect(r.body).toBe('placed')
    expect(r.severityNumber).toBe(SeverityNumber.INFO)
    expect(r.severityText).toBe('info')
    expect(r.attributes.orderId).toBe('o1')
    expect(r.attributes.count).toBe(2)
    expect(r.instrumentationScope.name).toBe('orders')
    expect(r.instrumentationScope.version).toBe('1.0.0')
  })

  it('maps severities for all log levels', () => {
    const logger = new OpenTelemetryLogger('svc')
    logger.trace('t')
    logger.debug('d')
    logger.info('i')
    logger.warn('w')
    logger.error('e')
    logger.fatal('f')
    expect(exporter.records.map((x) => x.severityNumber)).toEqual([
      SeverityNumber.TRACE,
      SeverityNumber.DEBUG,
      SeverityNumber.INFO,
      SeverityNumber.WARN,
      SeverityNumber.ERROR,
      SeverityNumber.FATAL
    ])
  })

  it('adds exception attributes when logging an Error', () => {
    const logger = new OpenTelemetryLogger('svc')
    const err = new Error('boom')
    err.name = 'CustomError'
    logger.error('failed', err, { reqId: 'r1' })
    expect(exporter.records).toHaveLength(1)
    const attrs = exporter.records[0].attributes
    expect(attrs['exception.message']).toBe('boom')
    expect(attrs['exception.type']).toBe('CustomError')
    expect(attrs.reqId).toBe('r1')
    expect(typeof attrs['exception.stacktrace']).toBe('string')
  })

  it('stringifies non-Error values passed as error', () => {
    const logger = new OpenTelemetryLogger('svc')
    logger.error('x', 'not-an-error')
    expect(exporter.records[0].attributes['exception.message']).toBe('not-an-error')
  })

  it('omits undefined context keys from attributes', () => {
    const logger = new OpenTelemetryLogger('svc')
    logger.info('m', { a: '1', b: undefined })
    expect(Object.keys(exporter.records[0].attributes)).toEqual(['a'])
  })
})
