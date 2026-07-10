/**
 * Bootstrap OpenTelemetry before the rest of the app loads.
 *
 * OTEL export is optional — omit endpoint env vars and the app still runs.
 * Structured logs always go to the console via `createLogger()` regardless.
 */
import { initOpenTelemetry } from "@atlasmed/observability";
import { environment } from "./config/environment";

initOpenTelemetry({
  serviceName: environment.OTEL_SERVICE_NAME,
  endpoint: environment.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
  logsEndpoint: environment.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT,
  resourceAttributes: environment.OTEL_RESOURCE_ATTRIBUTES,
});
