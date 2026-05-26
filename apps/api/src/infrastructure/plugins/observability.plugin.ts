/**
 * Observability Plugin
 * 
 * Provides:
 * - Request ID generation and propagation
 * - Distributed tracing with OpenTelemetry (optional)
 * - Structured request/response logging
 * - Request duration tracking
 */

import { Elysia } from 'elysia';
import { opentelemetry } from '@elysiajs/opentelemetry';
import { trace } from '@opentelemetry/api';
import { logger } from '../logging/logger';
import { questdbLogger } from '../logging/questdb.logger';
import { environment } from '../../app/config/environment';

type RequestNamespace = 'api' | 'health' | 'internal';

interface RequestObservation {
  method: string;
  namespace: RequestNamespace;
  path: string;
  requestId: string;
  startedAt: number;
}

// Store request observations using WeakMap for automatic garbage collection
const requestObservations = new WeakMap<Request, RequestObservation>();
const loggedRequests = new WeakSet<Request>();

/**
 * Determine request namespace from path
 */
function getRequestNamespace(pathname: string): RequestNamespace {
  if (pathname.startsWith('/health')) return 'health';
  if (pathname.startsWith('/internal')) return 'internal';
  return 'api';
}

/**
 * Get or create request observation
 */
function getOrCreateObservation(
  request: Request,
  requestIdHeader?: string
): RequestObservation {
  const existing = requestObservations.get(request);
  if (existing) return existing;

  const path = new URL(request.url).pathname;
  const observation: RequestObservation = {
    method: request.method,
    namespace: getRequestNamespace(path),
    path,
    requestId: requestIdHeader?.trim() || crypto.randomUUID(),
    startedAt: Date.now()
  };

  requestObservations.set(request, observation);
  return observation;
}

/**
 * Apply OpenTelemetry span attributes
 */
function applySpanAttributes(
  observation: RequestObservation, 
  statusCode?: number
): void {
  const span = trace.getActiveSpan();
  if (!span) return;

  span.updateName(`${observation.method} ${observation.path}`);
  span.setAttribute('app.namespace', observation.namespace);
  span.setAttribute('http.request.method', observation.method);
  span.setAttribute('request.id', observation.requestId);
  span.setAttribute('url.path', observation.path);
  
  if (statusCode !== undefined) {
    span.setAttribute('http.response.status_code', statusCode);
  }
}

/**
 * Resolve status code from various formats
 */
function resolveStatusCode(candidate: unknown, fallback: number): number {
  if (typeof candidate === 'number' && Number.isFinite(candidate)) {
    return candidate;
  }
  
  if (typeof candidate === 'string') {
    const parsed = Number(candidate);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  
  return fallback;
}

/**
 * Resolve error status code (ensure >= 400)
 */
function resolveErrorStatusCode(candidate: unknown): number {
  const statusCode = resolveStatusCode(candidate, 500);
  return statusCode >= 400 ? statusCode : 500;
}

/**
 * Extract user ID from context (if authenticated)
 */
async function resolveUserId(context: Record<string, unknown>): Promise<string | undefined> {
  const getUserId = context.getUserId;
  
  if (typeof getUserId !== 'function') {
    return undefined;
  }
  
  try {
    const userId = await getUserId();
    return typeof userId === 'string' ? userId : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Build log context object
 */
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
    ...(userId && { userId })
  };
}

/**
 * Log request outcome with appropriate level
 */
function logRequestOutcome(params: {
  durationMs: number;
  error?: unknown;
  observation: RequestObservation;
  statusCode: number;
  userId?: string;
}): void {
  const context = buildLogContext(
    params.observation,
    params.statusCode,
    params.durationMs,
    params.userId
  );

  // Skip logging health checks in production unless there's an error
  if (
    params.observation.namespace === 'health' && 
    params.statusCode < 400 &&
    environment.NODE_ENV === 'production'
  ) {
    return;
  }

  if (params.statusCode >= 500) {
    const errorMessage = params.error instanceof Error ? params.error.message : 'Request failed';
    logger.error(context, errorMessage);
    if (params.error instanceof Error && environment.NODE_ENV === 'development') {
      logger.error({ stack: params.error.stack }, 'Error stack trace');
    }
    // Persist to QuestDB (async, non-blocking)
    questdbLogger.log({
      level: 'error',
      message: errorMessage,
      requestId: params.observation.requestId,
      userId: params.userId,
      method: params.observation.method,
      route: params.observation.path,
      statusCode: params.statusCode,
      durationMs: params.durationMs,
      error: params.error instanceof Error ? params.error.stack : String(params.error),
    }).catch(() => {}); // Silently fail
    return;
  }

  if (params.statusCode >= 400) {
    logger.warn(context, 'Request rejected');
    // Persist to QuestDB (async, non-blocking)
    questdbLogger.log({
      level: 'warn',
      message: 'Request rejected',
      requestId: params.observation.requestId,
      userId: params.userId,
      method: params.observation.method,
      route: params.observation.path,
      statusCode: params.statusCode,
      durationMs: params.durationMs,
    }).catch(() => {}); // Silently fail
    return;
  }

  logger.info(context, 'Request completed');
  // Persist to QuestDB (async, non-blocking)
  questdbLogger.log({
    level: 'info',
    message: 'Request completed',
    requestId: params.observation.requestId,
    userId: params.userId,
    method: params.observation.method,
    route: params.observation.path,
    statusCode: params.statusCode,
    durationMs: params.durationMs,
  }).catch(() => {}); // Silently fail
}

/**
 * Mark request as logged to avoid duplicate logs
 */
function markRequestAsLogged(request: Request): void {
  loggedRequests.add(request);
}

/**
 * Check if request was already logged
 */
function hasLoggedRequest(request: Request): boolean {
  return loggedRequests.has(request);
}

// OpenTelemetry plugin (conditional)
const tracePlugin = environment.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT
  ? opentelemetry({ 
      serviceName: environment.OTEL_SERVICE_NAME,
    })
  : new Elysia({ name: 'disabled-tracing' });

/**
 * Observability Plugin
 * 
 * Add to app with: app.use(observabilityPlugin)
 */
export const observabilityPlugin = new Elysia({ name: 'observability' })
  .use(tracePlugin)
  
  // Capture request start
  .onRequest(({ request, set }) => {
    const observation = getOrCreateObservation(
      request,
      request.headers.get('x-request-id') ?? undefined
    );
    
    // Add request ID to response headers
    set.headers['x-request-id'] = observation.requestId;
    
    // Apply OpenTelemetry span attributes
    applySpanAttributes(observation);
  })
  
  // Log successful requests
  .onAfterHandle({ as: 'global' }, async (context) => {
    const observation = getOrCreateObservation(context.request);
    const statusCode = resolveStatusCode(context.set.status, 200);
    const durationMs = Date.now() - observation.startedAt;
    const userId = await resolveUserId(context as unknown as Record<string, unknown>);

    context.set.headers['x-request-id'] = observation.requestId;
    
    applySpanAttributes(observation, statusCode);
    
    logRequestOutcome({
      observation,
      statusCode,
      durationMs,
      userId
    });
    
    markRequestAsLogged(context.request);
  })
  
  // Log errors
  .onError({ as: 'global' }, async (context) => {
    const observation = getOrCreateObservation(context.request);
    const statusCode = resolveErrorStatusCode(context.set.status);
    const durationMs = Date.now() - observation.startedAt;
    const userId = await resolveUserId(context as unknown as Record<string, unknown>);

    context.set.headers['x-request-id'] = observation.requestId;
    
    applySpanAttributes(observation, statusCode);
    
    logRequestOutcome({
      observation,
      statusCode,
      durationMs,
      userId,
      error: context.error
    });
    
    markRequestAsLogged(context.request);
  })
  
  // Fallback logging (if not logged by above hooks)
  .onAfterResponse({ as: 'global' }, async (context) => {
    if (hasLoggedRequest(context.request)) return;

    const observation = getOrCreateObservation(context.request);
    const statusCode = resolveStatusCode(context.set.status, 200);
    const durationMs = Date.now() - observation.startedAt;
    const userId = await resolveUserId(context as unknown as Record<string, unknown>);

    applySpanAttributes(observation, statusCode);
    
    logRequestOutcome({
      observation,
      statusCode,
      durationMs,
      userId
    });
    
    markRequestAsLogged(context.request);
  });
