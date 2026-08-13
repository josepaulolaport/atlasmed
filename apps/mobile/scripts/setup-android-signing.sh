#!/usr/bin/env bash

set -euo pipefail

: "${RUNNER_TEMP:?RUNNER_TEMP is required}"
: "${GITHUB_OUTPUT:?GITHUB_OUTPUT is required}"
: "${ANDROID_KEYSTORE_BASE64:?ANDROID_KEYSTORE_BASE64 is required}"
: "${ANDROID_KEY_ALIAS:?ANDROID_KEY_ALIAS is required}"
: "${ANDROID_KEY_PASSWORD:?ANDROID_KEY_PASSWORD is required}"
: "${ANDROID_STORE_PASSWORD:?ANDROID_STORE_PASSWORD is required}"
: "${PLAY_STORE_SERVICE_ACCOUNT_JSON_BASE64:?PLAY_STORE_SERVICE_ACCOUNT_JSON_BASE64 is required}"

project_dir="$(cd "$(dirname "$0")/.." && pwd)"
keystore_path="$RUNNER_TEMP/atlasmed-upload-keystore.jks"
key_properties_path="$project_dir/android/key.properties"
play_service_account_path="$RUNNER_TEMP/google-play-service-account.json"

echo "$ANDROID_KEYSTORE_BASE64" | base64 --decode > "$keystore_path"
echo "$PLAY_STORE_SERVICE_ACCOUNT_JSON_BASE64" | base64 --decode > "$play_service_account_path"
chmod 600 "$keystore_path" "$play_service_account_path"

cat > "$key_properties_path" <<EOF
storePassword=$ANDROID_STORE_PASSWORD
keyPassword=$ANDROID_KEY_PASSWORD
keyAlias=$ANDROID_KEY_ALIAS
storeFile=$keystore_path
EOF
chmod 600 "$key_properties_path"

keytool -list \
  -keystore "$keystore_path" \
  -storepass "$ANDROID_STORE_PASSWORD" \
  -alias "$ANDROID_KEY_ALIAS" >/dev/null
jq -e 'type == "object" and (.client_email | type == "string") and (.private_key | type == "string")' \
  "$play_service_account_path" >/dev/null

echo "keystore_path=$keystore_path" >> "$GITHUB_OUTPUT"
echo "key_properties_path=$key_properties_path" >> "$GITHUB_OUTPUT"
echo "play_service_account_path=$play_service_account_path" >> "$GITHUB_OUTPUT"
