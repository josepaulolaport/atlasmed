#!/usr/bin/env bash

set -euo pipefail

: "${RUNNER_TEMP:?RUNNER_TEMP is required}"
: "${HOME:?HOME is required}"

script_dir="$(cd "$(dirname "$0")" && pwd)"
project_dir="$(cd "$script_dir/.." && pwd)"
rm -f "$project_dir/ios/Flutter/CodeSigning.xcconfig"

if [[ -n "${PROFILE_UUID:-}" ]]; then
  rm -f "$HOME/Library/MobileDevice/Provisioning Profiles/$PROFILE_UUID.mobileprovision"
  rm -f "$HOME/Library/Developer/Xcode/UserData/Provisioning Profiles/$PROFILE_UUID.mobileprovision"
fi

if [[ -n "${KEYCHAIN_PATH:-}" && -f "$KEYCHAIN_PATH" ]]; then
  security default-keychain -d user -s login.keychain-db || true
  security delete-keychain "$KEYCHAIN_PATH" || true
fi

rm -f \
  "$RUNNER_TEMP/atlasmed-distribution.p12" \
  "$RUNNER_TEMP/atlasmed-app-store.mobileprovision" \
  "$RUNNER_TEMP/atlasmed-app-store.plist" \
  "$RUNNER_TEMP"/AuthKey_*.p8
