#!/usr/bin/env bash
#
# Runs a Flutter command, retrying **only** when it failed because a native
# asset could not be downloaded.
#
# `pdfium_dart` builds via a hook that fetches a prebuilt library from a
# third-party GitHub release the first time it is needed. On 2026-08-13 that
# download died mid-header and took a production deploy with it:
#
#   ClientException: Connection closed before full header was received,
#   uri=.../pdfium-binaries/releases/download/chromium%2F7811/pdfium-linux-x64.tgz
#   Building native assets failed.
#
# No test had run at that point. The suite never started.
#
# Retrying the whole command is the obvious response and the wrong one on its
# own: it also retries genuine test failures, so a test that fails one run in
# three starts reporting green and CI quietly stops being evidence. So this
# retries only when the output carries the native-assets signature, and exits
# immediately on anything else — an ordinary test failure fails the first time,
# as it should.
#
# Caching the artifact (see the workflows) is the primary fix; this covers the
# cache miss, which is every dependency bump.

set -uo pipefail

if [[ $# -eq 0 ]]; then
  echo "uso: $0 <comando> [args...]" >&2
  exit 2
fi

readonly MAX_ATTEMPTS=3
readonly SIGNATURE='Building native assets failed|pdfium-binaries/releases/download'

log_file="$(mktemp)"
trap 'rm -f "$log_file"' EXIT

for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
  "$@" 2>&1 | tee "$log_file"
  status=${PIPESTATUS[0]}

  if [[ $status -eq 0 ]]; then
    if [[ $attempt -gt 1 ]]; then
      echo "::notice::Passou na tentativa $attempt após falha de download de asset nativo."
    fi
    exit 0
  fi

  if ! grep -qE "$SIGNATURE" "$log_file"; then
    # A real failure. Retrying would only hide it.
    echo "::error::Falha real (não é download de asset nativo) — sem retry." >&2
    exit "$status"
  fi

  if [[ $attempt -eq $MAX_ATTEMPTS ]]; then
    echo "::error::Download do asset nativo falhou em $MAX_ATTEMPTS tentativas." >&2
    exit "$status"
  fi

  backoff=$((attempt * 15))
  echo "::warning::Download de asset nativo falhou (tentativa $attempt/$MAX_ATTEMPTS). Nova tentativa em ${backoff}s."
  sleep "$backoff"
done
