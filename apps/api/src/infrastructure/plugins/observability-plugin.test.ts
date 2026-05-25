import { beforeEach, describe, expect, mock, test } from 'bun:test'
import Elysia from 'elysia'
import { OpenTelemetryLogger } from '../../../../packages/observability/src/logger/open-telemetry-logger'

type LoggedInfo = {
  context?: Record<string, unknown>
  message: string
}

type LoggedError = {
  context?: Record<string, unknown>
  error?: unknown
  message: string
}

const infoLogs: LoggedInfo[] = []
const errorLogs: LoggedError[] = []

mock.module('@api/infra/environment', () => ({
  environment: {
    OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: 'http://signoz:4318/v1/traces',
    OTEL_SERVICE_NAME: 'api'
  }
}))

mock.module('@elysiajs/opentelemetry', () => ({
  opentelemetry: () => new Elysia({ name: 'otel' })
}))

OpenTelemetryLogger.prototype.info = (message: string, context?: Record<string, unknown>) => {
  infoLogs.push({ message, context })
}

OpenTelemetryLogger.prototype.error = (
  message: string,
  error?: unknown,
  context?: Record<string, unknown>
) => {
  errorLogs.push({ message, error, context })
}

const { observabilityPlugin } = await import('./observability-plugin')

describe('observabilityPlugin', () => {
  beforeEach(() => {
    infoLogs.length = 0
    errorLogs.length = 0
  })

  test('reuses x-request-id and emits a structured request log', async () => {
    const app = new Elysia()
      .use(observabilityPlugin)
      .derive({ as: 'global' }, () => ({
        getUserId: async () => 'user-1'
      }))
      .get('/internal/health', () => ({ ok: true }))

    const response = await app.handle(
      new Request('http://localhost/internal/health', {
        headers: {
          'x-request-id': 'req-123'
        }
      })
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('x-request-id')).toBe('req-123')
    expect(infoLogs).toHaveLength(1)
    expect(infoLogs[0]).toEqual({
      message: 'Request completed',
      context: expect.objectContaining({
        'app.namespace': 'internal',
        method: 'GET',
        requestId: 'req-123',
        route: '/internal/health',
        statusCode: 200,
        userId: 'user-1'
      })
    })
  })

  test('does not emit error logs for expected 401 responses', async () => {
    const auth = new Elysia().derive({ as: 'global' }, ({ status }) =>
      status(401, {
        message: 'Unauthorized'
      })
    )

    const app = new Elysia()
      .use(observabilityPlugin)
      .use(auth)
      .get('/internal/me', () => ({
        ok: true
      }))

    const response = await app.handle(new Request('http://localhost/internal/me'))
    const requestId = response.headers.get('x-request-id')

    expect(response.status).toBe(401)
    expect(requestId).toBeTruthy()
    expect(errorLogs).toHaveLength(0)
    expect(infoLogs).toHaveLength(0)
  })

  test('generates request ids for failures and emits a structured error log', async () => {
    const app = new Elysia()
      .use(observabilityPlugin)
      .onError(({ error, set }) => {
        set.status = 500
        return {
          message: error.message
        }
      })
      .get('/webhooks/fail', () => {
        throw new Error('boom')
      })

    const response = await app.handle(new Request('http://localhost/webhooks/fail'))
    const requestId = response.headers.get('x-request-id')

    expect(response.status).toBe(500)
    expect(requestId).toBeTruthy()
    expect(errorLogs).toHaveLength(1)
    expect(errorLogs[0].message).toBe('Request failed')
    expect(errorLogs[0].error).toBeInstanceOf(Error)
    expect(errorLogs[0].context).toEqual(
      expect.objectContaining({
        'app.namespace': 'webhooks',
        method: 'GET',
        requestId,
        route: '/webhooks/fail',
        statusCode: 500
      })
    )
  })
})
