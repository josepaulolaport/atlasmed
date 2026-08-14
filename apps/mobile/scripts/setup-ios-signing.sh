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

script_dir="$(cd "$(dirname "$0")" && pwd)"
project_dir="$(cd "$script_dir/.." && pwd)"
signing_xcconfig="$project_dir/ios/Flutter/CodeSigning.xcconfig"

export_options_path="$RUNNER_TEMP/atlasmed-export-options.plist"

certificate_path="$RUNNER_TEMP/atlasmed-distribution.p12"
profile_path="$RUNNER_TEMP/atlasmed-app-store.mobileprovision"
profile_plist="$RUNNER_TEMP/atlasmed-app-store.plist"
api_key_path="$RUNNER_TEMP/AuthKey_${ASC_KEY_ID}.p8"
keychain_path="$RUNNER_TEMP/atlasmed-signing.keychain-db"

echo "keychain_path=$keychain_path" >> "$GITHUB_OUTPUT"

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
echo "profile_uuid=$profile_uuid" >> "$GITHUB_OUTPUT"

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

# Xcode assina automaticamente por padrão, o que exige uma conta Apple na
# aba Accounts — inexistente no runner. Sobrescrevemos os build settings do
# alvo Runner (Release) para assinar manualmente com o certificado e o
# profile que acabamos de instalar. O include é opcional em Release.xcconfig,
# então máquinas de desenvolvimento seguem no modo automático.
cat > "$signing_xcconfig" <<EOF
// Gerado por scripts/setup-ios-signing.sh — não versionar.
CODE_SIGN_STYLE = Manual
CODE_SIGN_IDENTITY = Apple Distribution
CODE_SIGN_IDENTITY[sdk=iphoneos*] = Apple Distribution
DEVELOPMENT_TEAM = $APPLE_TEAM_ID
PROVISIONING_PROFILE_SPECIFIER = $profile_name
EOF

echo "Assinatura manual configurada em ios/Flutter/CodeSigning.xcconfig"

# O xcconfig acima cobre apenas o archive. O export do IPA é uma invocação
# separada do xcodebuild, guiada por um ExportOptions.plist — e o que o Flutter
# gera sozinho traz só a chave "method", o que faz o exportArchive falhar com
# "Runner.app requires a provisioning profile". Geramos o plist explicitamente
# e o passamos ao Shorebird via --export-options-plist.
#
# manageAppVersionAndBuildNumber precisa ser false: o Xcode reescreveria o build
# number do IPA e ele deixaria de bater com a release registrada no Shorebird,
# quebrando os patches. O próprio CLI rejeita o plist se essa chave for true.
cat > "$export_options_path" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>method</key>
	<string>app-store-connect</string>
	<key>teamID</key>
	<string>$APPLE_TEAM_ID</string>
	<key>signingStyle</key>
	<string>manual</string>
	<key>signingCertificate</key>
	<string>Apple Distribution</string>
	<key>provisioningProfiles</key>
	<dict>
		<key>br.com.atlasmed.app</key>
		<string>$profile_uuid</string>
	</dict>
	<key>manageAppVersionAndBuildNumber</key>
	<false/>
	<key>stripSwiftSymbols</key>
	<true/>
	<key>uploadBitcode</key>
	<false/>
</dict>
</plist>
EOF

plutil -lint "$export_options_path"

echo "signing_xcconfig_path=$signing_xcconfig" >> "$GITHUB_OUTPUT"
echo "export_options_plist_path=$export_options_path" >> "$GITHUB_OUTPUT"
echo "api_key_path=$api_key_path" >> "$GITHUB_OUTPUT"
