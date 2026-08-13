#!/usr/bin/env bash

set -euo pipefail

: "${RUNNER_TEMP:?RUNNER_TEMP is required}"

project_dir="$(cd "$(dirname "$0")/.." && pwd)"

for path in \
  "${ANDROID_KEYSTORE_PATH:-$RUNNER_TEMP/atlasmed-upload-keystore.jks}" \
  "${ANDROID_KEY_PROPERTIES_PATH:-$project_dir/android/key.properties}" \
  "${PLAY_STORE_SERVICE_ACCOUNT_JSON_PATH:-$RUNNER_TEMP/google-play-service-account.json}"; do
  if [[ -n "$path" ]]; then
    rm -f "$path"
  fi
done
