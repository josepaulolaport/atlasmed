#!/usr/bin/env bash

set -euo pipefail

: "${RUNNER_TEMP:?RUNNER_TEMP is required}"
: "${GITHUB_OUTPUT:?GITHUB_OUTPUT is required}"
: "${HOME:?HOME is required}"
: "${APPLE_TEAM_ID:?APPLE_TEAM_ID is required}"
: "${CERTIFICATE_BASE64:?CERTIFICATE_BASE64 is required}"
: "${CERTIFICATE_PASSWORD:?CERTIFICATE_PASSWORD is required}"
: "${PROVISIONING_PROFILE_BASE64:?PROVISIONING_PROFILE_BASE64 is required}"
: "${KEYCHAIN_PASSWORD:?KEYCHAIN_PASSWORD is required}"
: "${ASC_KEY_BASE64:?ASC_KEY_BASE64 is required}"
: "${ASC_KEY_ID:?ASC_KEY_ID is required}"

certificate_path="$RUNNER_TEMP/atlasmed-distribution.p12"
profile_path="$RUNNER_TEMP/atlasmed-app-store.mobileprovision"
profile_plist="$RUNNER_TEMP/atlasmed-app-store.plist"
api_key_path="$RUNNER_TEMP/AuthKey_${ASC_KEY_ID}.p8"
keychain_path="$RUNNER_TEMP/atlasmed-signing.keychain-db"

echo "$CERTIFICATE_BASE64" | base64 --decode > "$certificate_path"
echo "$PROVISIONING_PROFILE_BASE64" | base64 --decode > "$profile_path"
echo "$ASC_KEY_BASE64" | base64 --decode > "$api_key_path"
chmod 600 "$certificate_path" "$profile_path" "$api_key_path"

security create-keychain -p "$KEYCHAIN_PASSWORD" "$keychain_path"
security set-keychain-settings -lut 21600 "$keychain_path"
security unlock-keychain -p "$KEYCHAIN_PASSWORD" "$keychain_path"
security import "$certificate_path" \
  -P "$CERTIFICATE_PASSWORD" \
  -A \
  -t cert \
  -f pkcs12 \
  -k "$keychain_path"
security set-key-partition-list \
  -S apple-tool:,apple: \
  -s \
  -k "$KEYCHAIN_PASSWORD" \
  "$keychain_path"
security list-keychains -d user -s "$keychain_path" login.keychain-db
security default-keychain -d user -s "$keychain_path"

identities=$(security find-identity -v -p codesigning "$keychain_path")
echo "$identities"
if ! grep -q 'Apple Distribution' <<< "$identities"; then
  echo "Nenhuma identidade Apple Distribution válida foi importada" >&2
  exit 1
fi

security cms -D -i "$profile_path" > "$profile_plist"
profile_uuid=$(/usr/libexec/PlistBuddy -c 'Print :UUID' "$profile_plist")
profile_name=$(/usr/libexec/PlistBuddy -c 'Print :Name' "$profile_plist")
profile_team=$(/usr/libexec/PlistBuddy -c 'Print :TeamIdentifier:0' "$profile_plist")
application_identifier=$(/usr/libexec/PlistBuddy -c 'Print :Entitlements:application-identifier' "$profile_plist")

if [[ "$profile_team" != "$APPLE_TEAM_ID" ]]; then
  echo "Provisioning profile pertence ao time $profile_team, esperado $APPLE_TEAM_ID" >&2
  exit 1
fi
if [[ "$application_identifier" != "$APPLE_TEAM_ID.br.com.atlasmed.app" ]]; then
  echo "App identifier inválido no profile: $application_identifier" >&2
  exit 1
fi

profiles_dir="$HOME/Library/MobileDevice/Provisioning Profiles"
xcode_profiles_dir="$HOME/Library/Developer/Xcode/UserData/Provisioning Profiles"
mkdir -p "$profiles_dir" "$xcode_profiles_dir"
cp "$profile_path" "$profiles_dir/$profile_uuid.mobileprovision"
cp "$profile_path" "$xcode_profiles_dir/$profile_uuid.mobileprovision"

echo "Profile instalado: $profile_name ($profile_uuid)"
echo "keychain_path=$keychain_path" >> "$GITHUB_OUTPUT"
echo "profile_uuid=$profile_uuid" >> "$GITHUB_OUTPUT"
echo "api_key_path=$api_key_path" >> "$GITHUB_OUTPUT"
