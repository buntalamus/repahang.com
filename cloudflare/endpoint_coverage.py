#!/usr/bin/env python3
"""Inventory HTTP routes needed before the PHP domain can move to Worker.

This checks route presence only. A route may still implement only GET, or be
disabled by the staging feature flags; it is not a functional parity test.
"""

from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend" / "src"
WORKER_ROUTES = ROOT / "cloudflare" / "src" / "index.ts"
ENDPOINT = re.compile(r"\b([a-z][a-z0-9-]*\.php)\b")
ROUTE = re.compile(r"/api/([a-z][a-z0-9-]*\.php)")

# These routes are reached from email links, Telegram or direct browser URLs,
# so searching Angular alone misses them. Keep this list explicit: do not count
# debug/maintenance/CLI scripts as public application routes.
EXTERNAL_HTTP_ENDPOINTS = {
    "lantikan-jawab-token.php": "jawapan lantikan melalui emel",
    "penilaian-token.php": "borang penilaian RA bertoken",
    "laporan-pengesahan-token.php": "kelulusan laporan oleh pengerusi",
    "telegram-webhook.php": "webhook bot Telegram",
    "download-borang-futsal.php": "borang futsal melalui URL terus",
    "download-borang-ujian-kecergasan.php": "borang ujian kecergasan melalui URL terus",
}

# These are PHP CLI jobs, not HTTP routes. Their Worker replacement needs a
# Cron Trigger, Queue or another scheduled mechanism, plus a full behavior test.
BACKGROUND_JOBS = {
    "kup-crew-notification-retry.php": "cuba semula notifikasi kru KUP",
}

# A routed GET must not be mistaken for complete PHP GET/POST parity.
KNOWN_PARTIAL_ROUTES = {
    "lantikan-audit.php": "GET tersedia; empat tindakan POST masih 503",
    "kejohanan-pengesah-laporan.php": "GET tersedia; tetapan POST masih 503",
}


def main() -> None:
    used = set()
    for path in FRONTEND.rglob("*.ts"):
        used.update(ENDPOINT.findall(path.read_text(encoding="utf-8")))
    # A source comment mentions config/kriteria-penilaian.php, which is not
    # an HTTP endpoint. Count only files served from the PHP API directory.
    used = {name for name in used if (ROOT / "api" / name).is_file()}
    routed = set(ROUTE.findall(WORKER_ROUTES.read_text(encoding="utf-8")))
    missing = sorted(used - routed)
    print(f"Frontend PHP endpoints: {len(used)}")
    print(f"Routed in Worker: {len(used & routed)}")
    print(f"Still without route: {len(missing)}")
    for name in missing:
        print(f"  {name}")

    external = {name for name in EXTERNAL_HTTP_ENDPOINTS if (ROOT / "api" / name).is_file()}
    missing_external = sorted(external - routed)
    print(f"Non-frontend public PHP endpoints: {len(external)}")
    print(f"Routed in Worker: {len(external & routed)}")
    print(f"Still without route: {len(missing_external)}")
    for name in missing_external:
        print(f"  {name} — {EXTERNAL_HTTP_ENDPOINTS[name]}")

    partial = {name: note for name, note in KNOWN_PARTIAL_ROUTES.items() if name in routed}
    print(f"Known partial Worker routes: {len(partial)}")
    for name, note in partial.items():
        print(f"  {name} — {note}")

    print(f"Background PHP jobs requiring a Worker replacement: {len(BACKGROUND_JOBS)}")
    for name, purpose in BACKGROUND_JOBS.items():
        print(f"  {name} — {purpose} (not an HTTP endpoint)")


if __name__ == "__main__":
    main()
