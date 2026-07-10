# packages/observability/AGENTS.md

## Scope

Structured logging, distributed tracing, metrics helpers used across `apps/api`, `apps/workers`, and shared packages.

## Rules

- **Console first:** `createLogger()` always writes to stdout/stderr. SigNoz/OTEL is additive, not a replacement.
- **OTEL optional in dev:** Apps boot without `OTEL_EXPORTER_OTLP_*` env vars. Call `initOpenTelemetry()` anyway — it no-ops when endpoints are missing.
- Log structured JSON in production (`LOG_FORMAT=json`). Development defaults to readable single-line console output.
- Never log secrets, tokens, or password hashes.
- Trace names describe the operation, not the caller.
- Metrics live in a bounded cardinality set — never include user IDs or request IDs as label values.
- Errors flow through a single reporter with severity + fingerprint.

## Anti-patterns

- Do not `console.log` in service code — use the logger.
- Do not bypass tracing to "make it faster" — profile first.
