import { describe, expect, it } from 'bun:test'
import { parseResourceAttributes, resolveLogsEndpoint } from './otel'

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

  it('parses OTEL resource attributes', () => {
    expect(
      parseResourceAttributes('deployment.environment=development,service.version=1.0.0')
    ).toEqual({
      'deployment.environment': 'development',
      'service.version': '1.0.0'
    })
  })
})
