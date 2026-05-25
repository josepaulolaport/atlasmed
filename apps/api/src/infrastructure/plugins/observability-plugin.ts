import { environment } from '@api/infra/environment'
import { logger } from '@api/logger'
import { opentelemetry } from '@elysiajs/opentelemetry'
import { trace } from '@opentelemetry/api'
import { Elysia } from 'elysia'

type RequestNamespace = 'api' | 'internal' | 'webhooks'

type RequestObservation = {
  method: string
  namespace: RequestNamespace
  path: string
  requestId: string
  startedAt: number
}

const requestObservations = new WeakMap<Request, RequestObservation>()
const loggedRequests = new WeakSet<Request>()

function getRequestNamespace(pathname: string): RequestNamespace {
  if (pathname.startsWith('/internal')) {
    return 'internal'
  }

  if (pathname.startsWith('/webhooks')) {
    return 'webhooks'
  }

  return 'api'
}

function getRequestPath(request: Request): string {
  return new URL(request.url).pathname
}

function getOrCreateRequestObservation(
  request: Request,
  requestIdHeader?: string
): RequestObservation {
  const current = requestObservations.get(request)

  if (current) {
    return current
  }

  const path = getRequestPath(request)
  const observation: RequestObservation = {
    method: request.method,
    namespace: getRequestNamespace(path),
    path,
    requestId: requestIdHeader?.trim() || crypto.randomUUID(),
    startedAt: Date.now()
  }

  requestObservations.set(request, observation)
  return observation
}

function resolveStatusCode(candidate: unknown, fallback: number): number {
  if (typeof candidate === 'number' && Number.isFinite(candidate)) {
    return candidate
  }

  if (typeof candidate === 'string') {
    const parsed = Number(candidate)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return fallback
}

function resolveErrorStatusCode(candidate: unknown): number {
  const statusCode = resolveStatusCode(candidate, 500)
  return statusCode >= 400 ? statusCode : 500
}

function getActiveSpan() {
  return trace.getActiveSpan()
}

function applySpanAttributes(
  observation: RequestObservation,
  params?: {
    statusCode?: number
  }
): void {
  const span = getActiveSpan()

  if (!span) {
    return
  }

  span.updateName(`${observation.method} ${observation.path}`)
  span.setAttribute('app.namespace', observation.namespace)
  span.setAttribute('http.request.method', observation.method)
  span.setAttribute('request.id', observation.requestId)
  span.setAttribute('url.path', observation.path)

  if (params?.statusCode !== undefined) {
    span.setAttribute('http.response.status_code', params.statusCode)
  }
}

async function resolveUserId(context: Record<string, unknown>): Promise<string | undefined> {
  const getUserId = context.getUserId

  if (typeof getUserId !== 'function') {
    return undefined
  }

  try {
    const userId = await getUserId()
    return typeof userId === 'string' ? userId : undefined
  } catch {
    return undefined
  }
}

function buildLogContext(
  observation: RequestObservation,
  statusCode: number,
  durationMs: number,
  userId?: string
) {
  return {
    'app.namespace': observation.namespace,
    durationMs,
    method: observation.method,
    requestId: observation.requestId,
    route: observation.path,
    statusCode,
    ...(userId ? { userId } : {})
  }
}

function logRequestOutcome(params: {
  durationMs: number
  error?: unknown
  observation: RequestObservation
  statusCode: number
  userId?: string
}): void {
  const context = buildLogContext(
    params.observation,
    params.statusCode,
    params.durationMs,
    params.userId
  )

  if (params.statusCode >= 500) {
    logger.error('Request failed', params.error, context)
    return
  }

  if (params.statusCode >= 400) {
    logger.info('Request rejected', context)
    return
  }

  logger.info('Request completed', context)
}

function markRequestAsLogged(request: Request): void {
  loggedRequests.add(request)
}

function hasLoggedRequest(request: Request): boolean {
  return loggedRequests.has(request)
}

const tracePlugin =
  environment.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT !== undefined
    ? opentelemetry({
        serviceName: environment.OTEL_SERVICE_NAME
      })
    : new Elysia({ name: 'disabled-opentelemetry' })

export const observabilityPlugin = new Elysia({ name: 'observability' })
  .use(tracePlugin)
  .onRequest(({ request, set }) => {
    const observation = getOrCreateRequestObservation(
      request,
      request.headers.get('x-request-id') ?? undefined
    )
    set.headers['x-request-id'] = observation.requestId
    applySpanAttributes(observation)
  })
  .onAfterHandle({ as: 'global' }, async (context) => {
    const observation = getOrCreateRequestObservation(
      context.request,
      context.request.headers.get('x-request-id') ?? undefined
    )
    context.set.headers['x-request-id'] = observation.requestId
    const statusCode = resolveStatusCode(context.set.status, 200)
    const durationMs = Date.now() - observation.startedAt
    const userId = await resolveUserId(context as unknown as Record<string, unknown>)

    applySpanAttributes(observation, { statusCode })

    logRequestOutcome({
      observation,
      statusCode,
      durationMs,
      userId
    })
    markRequestAsLogged(context.request)
  })
  .onError({ as: 'global' }, async (context) => {
    const observation = getOrCreateRequestObservation(
      context.request,
      context.request.headers.get('x-request-id') ?? undefined
    )
    context.set.headers['x-request-id'] = observation.requestId
    const statusCode = resolveErrorStatusCode(context.set.status)
    const durationMs = Date.now() - observation.startedAt
    const userId = await resolveUserId(context as unknown as Record<string, unknown>)

    applySpanAttributes(observation, { statusCode })

    logRequestOutcome({
      observation,
      statusCode,
      durationMs,
      userId,
      error: context.error
    })
    markRequestAsLogged(context.request)
  })
  .onAfterResponse({ as: 'global' }, async (context) => {
    if (hasLoggedRequest(context.request)) {
      return
    }

    const observation = getOrCreateRequestObservation(
      context.request,
      context.request.headers.get('x-request-id') ?? undefined
    )
    const statusCode = resolveStatusCode(context.set.status, 200)
    const durationMs = Date.now() - observation.startedAt
    const userId = await resolveUserId(context as unknown as Record<string, unknown>)

    applySpanAttributes(observation, { statusCode })

    logRequestOutcome({
      observation,
      statusCode,
      durationMs,
      userId
    })
    markRequestAsLogged(context.request)
  })
