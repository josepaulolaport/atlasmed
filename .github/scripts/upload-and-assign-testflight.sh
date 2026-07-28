#!/usr/bin/env bash
# Upload an IPA with altool, wait for the build, assign to a TestFlight beta group.
set -euo pipefail

IPA="${1:?ipa path required}"
: "${APP_STORE_CONNECT_KEY_ID:?}"
: "${APP_STORE_CONNECT_ISSUER_ID:?}"
: "${ASC_KEY_PATH:?}"
: "${BUILD_NUMBER:?}"
: "${BUNDLE_ID:?}"
: "${MARKETING_VERSION:?}"
BETA_GROUP="${BETA_GROUP:-Main}"

echo "Uploading $IPA (bundle=$BUNDLE_ID version=$MARKETING_VERSION+$BUILD_NUMBER)"
# --upload-app still works with API key and does not require --apple-id.
# (Newer --upload-package requires apple-id + asc-public-id.)
set +e
UPLOAD_LOG="$(mktemp)"
xcrun altool --upload-app \
  --file "$IPA" \
  --type ios \
  --apiKey "$APP_STORE_CONNECT_KEY_ID" \
  --apiIssuer "$APP_STORE_CONNECT_ISSUER_ID" 2>&1 | tee "$UPLOAD_LOG"
UPLOAD_RC=${PIPESTATUS[0]}
set -e
if [[ "$UPLOAD_RC" -ne 0 ]]; then
  if grep -qiE 'already been uploaded|duplicate|Redundant' "$UPLOAD_LOG"; then
    echo "Upload skipped — build already on App Store Connect"
  else
    exit "$UPLOAD_RC"
  fi
fi

VENV="${RUNNER_TEMP:-/tmp}/asc-venv"
python3 -m venv "$VENV"
# shellcheck disable=SC1091
source "$VENV/bin/activate"
python3 -m pip install --quiet PyJWT cryptography

python3 <<'PY'
import json, os, sys, time, urllib.request
import jwt

key_id = os.environ["APP_STORE_CONNECT_KEY_ID"]
issuer = os.environ["APP_STORE_CONNECT_ISSUER_ID"]
key_path = os.environ["ASC_KEY_PATH"]
group_query = os.environ.get("BETA_GROUP", "Main").strip().lower()
build_number = os.environ["BUILD_NUMBER"]
bundle_id = os.environ["BUNDLE_ID"]

with open(key_path, "r", encoding="utf-8") as f:
    private_key = f.read()


def token() -> str:
    now = int(time.time())
    return jwt.encode(
        {
            "iss": issuer,
            "iat": now,
            "exp": now + 1100,
            "aud": "appstoreconnect-v1",
        },
        private_key,
        algorithm="ES256",
        headers={"kid": key_id},
    )


def api(method: str, path: str, body: dict | None = None):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(
        f"https://api.appstoreconnect.apple.com{path}",
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {token()}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read().decode()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        print(e.read().decode(), file=sys.stderr)
        raise


apps = api("GET", f"/v1/apps?filter[bundleId]={bundle_id}")
if not apps.get("data"):
    print("No app for bundle", bundle_id, file=sys.stderr)
    sys.exit(1)
app_id = apps["data"][0]["id"]
print("app_id", app_id)

build_id = None
for attempt in range(60):
    builds = api(
        "GET",
        f"/v1/builds?filter[app]={app_id}&filter[version]={build_number}&sort=-uploadedDate&limit=5",
    )
    items = builds.get("data") or []
    if items:
        build_id = items[0]["id"]
        state = items[0].get("attributes", {}).get("processingState")
        print(f"build {build_id} processingState={state} (try {attempt + 1})")
        if state == "FAILED":
            print("Build processing failed", file=sys.stderr)
            sys.exit(1)
        if state == "VALID":
            break
    else:
        print(f"build not listed yet (try {attempt + 1})")
    time.sleep(30)
else:
    print("Timed out waiting for build", file=sys.stderr)
    sys.exit(1)

groups = api("GET", f"/v1/apps/{app_id}/betaGroups?limit=50")
matched = None
for g in groups.get("data") or []:
    name = (g.get("attributes") or {}).get("name") or ""
    print(
        "betaGroup:",
        name,
        "internal=",
        (g.get("attributes") or {}).get("isInternalGroup"),
    )
    if group_query in name.lower():
        matched = g
        break
if matched is None:
    for g in groups.get("data") or []:
        if (g.get("attributes") or {}).get("isInternalGroup"):
            matched = g
            break
if matched is None:
    print("No matching beta group", file=sys.stderr)
    sys.exit(1)

group_id = matched["id"]
group_name = matched["attributes"]["name"]
is_internal = bool((matched.get("attributes") or {}).get("isInternalGroup"))
print(
    f"Target group '{group_name}' ({group_id}) internal={is_internal} build={build_id}"
)

if is_internal:
    # ASC rejects assigning builds to internal groups via the API.
    # Internal Testers already receive VALID builds automatically.
    print(
        "Internal group — no API assign needed; build is available to Main/internal testers."
    )
else:
    print(f"Assigning build {build_id} → external group '{group_name}'")
    try:
        api(
            "POST",
            f"/v1/builds/{build_id}/relationships/betaGroups",
            {"data": [{"type": "betaGroups", "id": group_id}]},
        )
    except Exception:
        api(
            "POST",
            f"/v1/betaGroups/{group_id}/relationships/builds",
            {"data": [{"type": "builds", "id": build_id}]},
        )
    print("Assigned OK")
PY
