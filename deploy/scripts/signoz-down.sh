#!/usr/bin/env bash
set -euo pipefail

CACHE_DIR="${ATLASMED_SIGNOZ_DIR:-${XDG_DATA_HOME:-$HOME/.local/share}/atlasmed/signoz}"
COMPOSE_DIR="$CACHE_DIR/deploy/docker"

if [ ! -f "$COMPOSE_DIR/docker-compose.yaml" ]; then
  echo "SigNoz is not installed (run bun run observability:up first)."
  exit 0
fi

cd "$COMPOSE_DIR"
docker compose down
