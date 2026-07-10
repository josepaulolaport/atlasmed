/**
 * Bootstrap OpenTelemetry before the worker loads.
 *
 * OTEL export is optional — omit endpoint env vars and the worker still runs.
 * Structured logs always go to the console via `createLogger()` regardless.
 */
import { initOpenTelemetry } from "@atlasmed/observability";

initOpenTelemetry({
  serviceName: process.env.OTEL_SERVICE_NAME ?? "atlasmed-cnes-worker",
  endpoint: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
  logsEndpoint: process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT,
  resourceAttributes: process.env.OTEL_RESOURCE_ATTRIBUTES,
});
