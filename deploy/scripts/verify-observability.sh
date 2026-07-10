#!/usr/bin/env bash
set -euo pipefail

OTLP_HTTP="${OTEL_EXPORTER_OTLP_TRACES_ENDPOINT:-http://localhost:4318/v1/traces}"
SIGNOZ_UI="${SIGNOZ_UI_URL:-http://localhost:8080}"

echo "Checking SigNoz UI at ${SIGNOZ_UI}..."
if curl -sf "${SIGNOZ_UI}/api/v1/health" >/dev/null 2>&1 || curl -sf "${SIGNOZ_UI}" >/dev/null 2>&1; then
  echo "✓ SigNoz UI reachable"
else
  echo "✗ SigNoz UI not reachable — run: bun run observability:up"
  exit 1
fi

echo "Checking OTLP HTTP receiver..."
if curl -sf -o /dev/null -w "%{http_code}" -X POST "${OTLP_HTTP}" \
  -H "Content-Type: application/json" \
  -d '{"resourceSpans":[]}' | grep -Eq '^(200|202|400|415)$'; then
  echo "✓ OTLP traces endpoint responding at ${OTLP_HTTP}"
else
  echo "✗ OTLP traces endpoint not reachable at ${OTLP_HTTP}"
  exit 1
fi

echo ""
echo "Observability stack looks healthy."
echo "Start the API with OTEL env vars uncommented in apps/api/.env to ship traces/logs."
