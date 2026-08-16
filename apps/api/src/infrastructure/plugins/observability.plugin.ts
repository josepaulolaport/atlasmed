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
// Errors are recorded by `onError` and consumed later by `onAfterResponse`,
// once `set.status` reflects the status the central app-level error handler
// actually assigned — `onError` hooks run in registration order, so this
// plugin's `onError` fires before that handler and would otherwise only
// ever see the pre-handler default (500), even for a plain 401/403/404.
const requestErrors = new WeakMap<Request, unknown>();

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
async function resolveUserId(context: Record<string, unknown>): Promise<number | undefined> {
  const getUserId = context.getUserId;
  
  if (typeof getUserId !== 'function') {
    return undefined;
  }
  
  try {
    const userId = await getUserId();
    return typeof userId === 'number' ? userId : undefined;
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
  userId?: number
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
  userId?: number;
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
    logger.error(errorMessage, params.error instanceof Error ? params.error : undefined, context);
    return;
  }

  if (params.statusCode >= 400) {
    // Say *why*. A 4xx logged as a bare "Request rejected" tells whoever is
    // debugging it nothing the status code did not already say, and the client
    // is usually the only place the reason was ever visible.
    const reason = params.error instanceof Error ? params.error.message : undefined;
    const code = (params.error as { code?: unknown } | undefined)?.code;
    logger.warn(
      { ...context, ...(code ? { errorCode: String(code) } : {}), ...(reason ? { reason } : {}) },
      'Request rejected',
    );
    return;
  }

  logger.info(context, 'Request completed');
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
  
  // Record the error for later — do NOT log or read `set.status` here.
  // This hook runs before the central app-level `.onError` (registration
  // order), so `set.status` is still whatever Elysia defaults it to on an
  // unhandled throw, not the real 401/403/404/etc. the app assigns
  // afterward. Logging here would misreport a normal auth rejection as a
  // 500, both misleading anyone reading logs and triggering error-level
  // alerts for routine 4xx traffic.
  .onError({ as: 'global' }, ({ request, error }) => {
    requestErrors.set(request, error);
  })

  // Log every request exactly once, after the response is fully finalized
  // — by this point `set.status` is guaranteed to reflect whatever the
  // central error handler (or the route handler) actually decided, so
  // errors are reported with their real status code instead of a
  // premature default.
  .onAfterResponse({ as: 'global' }, async (context) => {
    if (hasLoggedRequest(context.request)) return;

    const observation = getOrCreateObservation(context.request);
    const error = requestErrors.get(context.request);
    const statusCode = error
      ? resolveErrorStatusCode(context.set.status)
      : resolveStatusCode(context.set.status, 200);
    const durationMs = Date.now() - observation.startedAt;
    const userId = await resolveUserId(context as unknown as Record<string, unknown>);

    context.set.headers['x-request-id'] = observation.requestId;
    applySpanAttributes(observation, statusCode);

    logRequestOutcome({
      observation,
      statusCode,
      durationMs,
      userId,
      error
    });

    requestErrors.delete(context.request);
    markRequestAsLogged(context.request);
  });
