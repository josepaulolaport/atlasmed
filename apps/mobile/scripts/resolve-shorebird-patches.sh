#!/usr/bin/env bash
# ── resolve-shorebird-patches.sh ────────────────────────────────────
# Lê shorebird-patches.json e executa `shorebird patch` para cada entrada.
#
# Uso:
#   ./scripts/resolve-shorebird-patches.sh [count|list|json|validate|run]
#   ./scripts/resolve-shorebird-patches.sh run [--manifest path]
#
# Flags passadas ao shorebird patch:
#   --allow-asset-diffs --allow-native-diffs
#
# Variáveis de ambiente:
#   SHOREBIRD_DRY_RUN  Acrescenta --dry-run
# ──────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
MANIFEST="${MANIFEST:-$PROJECT_DIR/shorebird-patches.json}"
FLAGS=(--no-confirm --allow-asset-diffs --allow-native-diffs)
if [[ "${SHOREBIRD_DRY_RUN:-false}" == "true" ]]; then
  FLAGS+=(--dry-run)
fi

# ── Help ───────────────────────────────────────────────────────────
if [ $# -eq 0 ] || [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
  sed -n '/^# ──/,/^$/p' "$0" | grep -v '^#!/bin/sh' | sed 's/^# //; s/^#$//'
  exit 0
fi

COMMAND="${1:-run}"
shift || true

while [ $# -gt 0 ]; do
  case "$1" in
    --manifest) MANIFEST="$2"; shift 2 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

# ── Validate manifest ───────────────────────────────────────────────
validate() {
  if ! command -v jq >/dev/null 2>&1; then
    echo "❌ jq is required but not installed." >&2
    exit 1
  fi

  if [ ! -f "$MANIFEST" ]; then
    echo "❌ Manifest not found: $MANIFEST" >&2
    exit 1
  fi

  jq -e '
    .patches | type == "array" and
    all(.[]; (.platform == "android" or .platform == "ios") and (.releaseVersion | type == "string" and length > 0))
  ' "$MANIFEST" >/dev/null 2>&1 || {
    echo "❌ Invalid manifest: expected android/ios patches with a releaseVersion" >&2
    exit 1
  }
}

# ── Count patches ──────────────────────────────────────────────────
count() {
  validate
  jq '.patches | length' "$MANIFEST"
}

# ── List patches (JSON) ────────────────────────────────────────────
list_json() {
  validate
  jq -c '.patches[]' "$MANIFEST"
}

# ── List patches (table) ───────────────────────────────────────────
list_table() {
  validate
  jq -r '.patches[] | [.platform, .releaseVersion] | @tsv' "$MANIFEST"
}

# ── Execute patches ────────────────────────────────────────────────
run_patches() {
  validate

  count=$(count)
  if [ "$count" -eq 0 ]; then
    echo "ℹ️  No patches to apply. Manifest is empty."
    exit 0
  fi

  echo "📦 Applying $count Shorebird patch(es) from $MANIFEST"
  echo ""

  STEP_SUMMARY="${GITHUB_STEP_SUMMARY:-/dev/null}"
  {
    echo "## 🚀 Shorebird Patches"
    echo ""
    echo "| Platform | Release Version | Status |"
    echo "|---|---|---|"
  } >> "$STEP_SUMMARY"

  jq -c '.patches[]' "$MANIFEST" | while read -r patch; do
    platform=$(echo "$patch" | jq -r '.platform')
    releaseVersion=$(echo "$patch" | jq -r '.releaseVersion')

    echo "▶️  Patching $platform @ $releaseVersion ..."

    # Patches iOS não precisam de IPA assinada; Android não aceita essa flag.
    platform_flags=()
    if [ "$platform" = "ios" ]; then
      platform_flags+=(--no-codesign)
    fi

    if shorebird patch \
      --platforms="$platform" \
      --release-version="$releaseVersion" \
      "${FLAGS[@]}" \
      ${platform_flags[@]+"${platform_flags[@]}"} \
      -- --dart-define-from-file=config.production.json --no-tree-shake-icons; then
      echo "  ✅ $platform @ $releaseVersion patched successfully"
      echo "| $platform | $releaseVersion | ✅ |" >> "$STEP_SUMMARY"
    else
      echo "  ❌ $platform @ $releaseVersion FAILED" >&2
      echo "| $platform | $releaseVersion | ❌ |" >> "$STEP_SUMMARY"
      exit 1
    fi

    echo ""
  done

  echo "✅ All patches applied."
}

# ── Dispatch ────────────────────────────────────────────────────────
case "$COMMAND" in
  count) count ;;
  list)  list_table ;;
  json)  list_json ;;
  validate) validate ;;
  run)   run_patches ;;
  *)
    echo "Unknown command: $COMMAND" >&2
    echo "Usage: $0 [count|list|json|validate|run]" >&2
    exit 1
    ;;
esac
