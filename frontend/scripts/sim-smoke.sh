#!/usr/bin/env bash
# ShelfPick iOS Simulator smoke capture (SIMULATOR evidence only; never
# physical-device, VoiceOver, owner or release evidence).
#
# Usage (from anywhere):
#   frontend/scripts/sim-smoke.sh              build, install, launch at AX3XL text,
#                                              capture sign-in (and onboarding when
#                                              run interactively)
#   frontend/scripts/sim-smoke.sh capture NAME capture another screenshot, e.g. after
#                                              signing in as local-onboarding
#   frontend/scripts/sim-smoke.sh restore      restore the Simulator's previous text size
#
# Environment:
#   SIM_DEVICE         existing Simulator name or UDID (default "iPhone 15"). The
#                      script never creates, erases or downloads a device/runtime.
#   VITE_API_BASE_URL  API origin embedded in the build (default http://127.0.0.1:8000,
#                      the local backend; the Simulator shares the Mac's loopback).
#   DERIVED_DATA       xcodebuild derived data path (default under /private/tmp).
set -euo pipefail

FRONTEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_DIR="$(cd "$FRONTEND_DIR/.." && pwd)"
SCREENSHOT_DIR="$REPO_DIR/docs/screenshots/sp-test-01a"
SIM_DEVICE="${SIM_DEVICE:-iPhone 15}"
BUNDLE_ID="com.shelfpick.prototype"
CONTENT_SIZE="accessibility-extra-extra-extra-large"
DERIVED_DATA="${DERIVED_DATA:-/private/tmp/shelfpick-sp-test-01a-derived}"
STATE_FILE="$DERIVED_DATA/sim-smoke-previous-content-size"
export VITE_API_BASE_URL="${VITE_API_BASE_URL:-http://127.0.0.1:8000}"

log() { printf '\n==> %s\n' "$*"; }

resolve_udid() {
  xcrun simctl list devices available -j | SIM_DEVICE="$SIM_DEVICE" python3 -c '
import json, os, re, sys
wanted = os.environ["SIM_DEVICE"]
data = json.load(sys.stdin)["devices"]
def version(runtime):
    return [int(part) for part in re.findall(r"\d+", runtime)]
matches = []
for runtime, devices in data.items():
    if "iOS" not in runtime:
        continue
    for device in devices:
        if device.get("isAvailable") and wanted in (device["name"], device["udid"]):
            matches.append((version(runtime), device["udid"]))
if matches:
    print(sorted(matches)[-1][1])
'
}

require_udid() {
  UDID="$(resolve_udid)"
  if [[ -z "$UDID" ]]; then
    echo "BLOCKED: no available iOS Simulator named or identified as '$SIM_DEVICE'." >&2
    echo "This script does not create devices. Available iPhone simulators:" >&2
    xcrun simctl list devices available | grep -E "^--|iPhone" >&2 || true
    echo "Re-run with SIM_DEVICE=\"<existing name or UDID>\"." >&2
    exit 3
  fi
  DEVICE_LABEL="$(xcrun simctl list devices available | grep "$UDID" | sed -E 's/^ +//; s/ \(.*$//')"
  RUNTIME_LABEL="$(xcrun simctl list devices available | awk -v id="$UDID" '/^-- /{rt=$0} index($0, id){print rt}' | sed 's/-- //; s/ --//')"
}

capture() {
  local name="$1"
  mkdir -p "$SCREENSHOT_DIR"
  local file="$SCREENSHOT_DIR/$name-ax3xl.png"
  xcrun simctl io "$UDID" screenshot --type=png "$file" >/dev/null
  echo "SIMULATOR screenshot: $file ($DEVICE_LABEL, $RUNTIME_LABEL, content size $CONTENT_SIZE)"
}

restore_content_size() {
  if [[ -f "$STATE_FILE" ]]; then
    local previous
    previous="$(cat "$STATE_FILE")"
    xcrun simctl ui "$UDID" content_size "$previous"
    rm -f "$STATE_FILE"
    echo "Restored Simulator content size to $previous."
  else
    echo "No saved content size to restore."
  fi
}

command="${1:-run}"
require_udid

case "$command" in
  capture)
    capture "${2:?capture needs a screenshot name, e.g. onboarding}"
    exit 0
    ;;
  restore)
    restore_content_size
    exit 0
    ;;
  run) ;;
  *)
    echo "Unknown command: $command (expected run, capture NAME or restore)" >&2
    exit 2
    ;;
esac

log "Target: $DEVICE_LABEL ($UDID), $RUNTIME_LABEL; API $VITE_API_BASE_URL"
cd "$FRONTEND_DIR"

log "npm run build"
npm run build

log "npx cap sync ios"
npx cap sync ios

log "xcodebuild (Debug, iOS Simulator, unsigned)"
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug \
  -destination "platform=iOS Simulator,id=$UDID" \
  -derivedDataPath "$DERIVED_DATA" \
  CODE_SIGNING_ALLOWED=NO build -quiet
APP_PATH="$DERIVED_DATA/Build/Products/Debug-iphonesimulator/App.app"
[[ -d "$APP_PATH" ]] || { echo "Built app not found at $APP_PATH" >&2; exit 1; }

log "Boot Simulator"
xcrun simctl boot "$UDID" 2>/dev/null || true
xcrun simctl bootstatus "$UDID" -b >/dev/null
open -b com.apple.iphonesimulator --args -CurrentDeviceUDID "$UDID" 2>/dev/null \
  || echo "Simulator window not opened (headless boot); screenshots still work."

log "Set Dynamic Type content size to $CONTENT_SIZE"
mkdir -p "$DERIVED_DATA"
if [[ ! -f "$STATE_FILE" ]]; then
  xcrun simctl ui "$UDID" content_size > "$STATE_FILE"
fi
xcrun simctl ui "$UDID" content_size "$CONTENT_SIZE"

log "Install and launch $BUNDLE_ID"
xcrun simctl terminate "$UDID" "$BUNDLE_ID" 2>/dev/null || true
xcrun simctl install "$UDID" "$APP_PATH"
xcrun simctl launch "$UDID" "$BUNDLE_ID"
sleep "${SIM_SMOKE_LAUNCH_WAIT:-6}"

if ! curl -fsS --max-time 3 "$VITE_API_BASE_URL/health" >/dev/null 2>&1; then
  echo "WARNING: $VITE_API_BASE_URL/health is not reachable; sign-in will fail until the local API runs." >&2
fi

log "Capture sign-in"
capture sign-in

if [[ -t 0 ]]; then
  echo
  echo "In the Simulator, sign in as local-onboarding@shelfpick.app (see docs/local-free-pro-testing.md),"
  read -r -p "wait for onboarding step 1, then press Return to capture it... " _
  capture onboarding
  restore_content_size
else
  cat <<EOF

Sign-in captured. To finish without a terminal prompt:
  1. Sign in as local-onboarding@shelfpick.app in the Simulator.
  2. $0 capture onboarding
  3. $0 restore
EOF
fi

echo
echo "Evidence label: SIMULATOR PASS candidate only. Not physical-device, VoiceOver or owner evidence."
