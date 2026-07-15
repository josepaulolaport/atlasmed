/**
 * Bootstrap OpenTelemetry before the worker loads.
 *
 * OTEL export is optional — omit endpoint env vars and the worker still runs.
 * Structured logs always go to the console via `createLogger()` regardless.
 */
import { environment } from '@atlasmed/config'
import { initOpenTelemetry } from '@atlasmed/observability'

initOpenTelemetry({
  serviceName: environment.OTEL_SERVICE_NAME,
  endpoint: environment.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
  logsEndpoint: environment.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT,
  resourceAttributes: environment.OTEL_RESOURCE_ATTRIBUTES
})
