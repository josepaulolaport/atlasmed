#!/usr/bin/env bash
set -euo pipefail

SIGNOZ_VERSION="${SIGNOZ_VERSION:-v0.129.0}"
CACHE_DIR="${ATLASMED_SIGNOZ_DIR:-${XDG_DATA_HOME:-$HOME/.local/share}/atlasmed/signoz}"
COMPOSE_DIR="$CACHE_DIR/deploy/docker"

if [ ! -f "$COMPOSE_DIR/docker-compose.yaml" ]; then
  echo "Downloading SigNoz $SIGNOZ_VERSION (first run only)..."
  rm -rf "$CACHE_DIR"
  git clone --depth 1 --branch "$SIGNOZ_VERSION" https://github.com/SigNoz/signoz.git "$CACHE_DIR"
fi

echo "Starting SigNoz from $COMPOSE_DIR"
cd "$COMPOSE_DIR"
docker compose up -d

echo ""
echo "SigNoz UI:        http://localhost:8080"
echo "OTLP gRPC:        localhost:4317"
echo "OTLP HTTP:        http://localhost:4318/v1/traces"
echo ""
echo "Set in apps/api/.env:"
echo "  OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4318/v1/traces"
echo "  OTEL_EXPORTER_OTLP_LOGS_ENDPOINT=http://localhost:4318/v1/logs"
