#!/usr/bin/env bash
set -euo pipefail

target_path="${1:-$HOME/.ssh/id_ed25519}"
target_dir="$(dirname "$target_path")"
raw_path="$target_path.raw"

if [ -z "${UNCLOUD_SSH_PRIVATE_KEY:-}" ]; then
  echo "UNCLOUD_SSH_PRIVATE_KEY is not set" >&2
  exit 1
fi

mkdir -p "$target_dir"
chmod 700 "$target_dir"

printf '%s' "$UNCLOUD_SSH_PRIVATE_KEY" \
  | sed -e '1s/^"//' -e '$s/"$//' \
  | tr -d '\r' > "$raw_path"

if grep -q '\\n' "$raw_path"; then
  perl -pe 's/\\n/\n/g' "$raw_path" > "$target_path"
  rm -f "$raw_path"
else
  mv "$raw_path" "$target_path"
fi

chmod 600 "$target_path"

if ! ssh-keygen -y -f "$target_path" >/dev/null 2>&1; then
  echo "Invalid UNCLOUD_SSH_PRIVATE_KEY: malformed or passphrase-protected key." >&2
  exit 1
fi
