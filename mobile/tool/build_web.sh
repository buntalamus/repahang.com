#!/usr/bin/env bash
# Builds the app for the web (the iPhone Home Screen app at /app/) and copies
# it into the portal's built assets. Run after the Angular build; the deploy
# scripts in cloudflare/package.json do this.
set -euo pipefail
cd "$(dirname "$0")/.."
flutter build web --release --base-href /app/ --no-web-resources-cdn --no-source-maps --no-wasm-dry-run
out=../frontend/dist/frontend/browser/app
rm -rf "$out"
mkdir -p "$out"
# Debug symbols, the unused skwasm renderers and Flutter's retired service
# worker are not shipped.
rsync -a --exclude '*.symbols' --exclude 'skwasm*' --exclude 'wimp.wasm' --exclude 'flutter_service_worker.js' build/web/ "$out/"
du -sh "$out"
