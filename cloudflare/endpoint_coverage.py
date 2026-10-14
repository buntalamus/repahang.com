#!/usr/bin/env python3
"""List frontend PHP endpoints that have a route in the staging Worker.

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


if __name__ == "__main__":
    main()
