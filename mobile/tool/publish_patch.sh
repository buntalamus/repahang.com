#!/usr/bin/env bash
# Ships a Dart-only change as a Shorebird OTA patch, then pushes
# "Kemas kini RefPahang tersedia" to every logged-in phone. Native changes
# (plugins, permissions, icons) need `shorebird release` and a new APK instead.
#
# Usage: tool/publish_patch.sh 1.2.0+6
set -euo pipefail
cd "$(dirname "$0")/.."

RELEASE="${1:?Usage: tool/publish_patch.sh <release version, e.g. 1.2.0+6>}"
# shellcheck disable=SC1091
source .release.env
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools

# Same build flags as the release (full icon font), or the patch is an asset diff.
"$HOME/.shorebird/bin/shorebird" patch android --release-version="$RELEASE" --no-confirm -- --no-tree-shake-icons

offset=0
while [ "$offset" != "null" ]; do
  response=$(curl -sS -X POST https://refpahang.com/api/mobile-broadcast.php \
    -H "X-Refpahang-Broadcast-Token: $MOBILE_BROADCAST_TOKEN" \
    -H 'Content-Type: application/json' \
    -d "{\"offset\":$offset}")
  echo "$response"
  offset=$(python3 -c 'import json,sys; n=json.loads(sys.argv[1]).get("next_offset"); print("null" if n is None else n)' "$response")
done
