import { describe, expect, it } from 'bun:test'
import { resolveLogsEndpoint } from './otel'

describe('otel', () => {
  it('derives the logs endpoint from the traces endpoint', () => {
    expect(
      resolveLogsEndpoint({
        endpoint: 'http://signoz:4318/v1/traces'
      })
    ).toBe('http://signoz:4318/v1/logs')
  })

  it('prefers the explicit logs endpoint when both endpoints are provided', () => {
    expect(
      resolveLogsEndpoint({
        endpoint: 'http://signoz:4318/v1/traces',
        logsEndpoint: 'http://collector:4318/v1/logs'
      })
    ).toBe('http://collector:4318/v1/logs')
  })
})
