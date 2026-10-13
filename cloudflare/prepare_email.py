#!/usr/bin/env python3
"""Check legacy mail settings and, when requested, stage them as Worker secrets.

The default command is read-only. Values are never printed or written to disk.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ACCOUNT_TYPES = ("ADMIN", "DAFTAR", "LANTIKAN", "SUPPORT", "PENGESAHAN")
SENDER_KEYS = tuple(
    key
    for account in ACCOUNT_TYPES
    for key in (f"MAIL_{account}_USER", f"MAIL_{account}_NAME")
)
EMAIL_KEYS = SENDER_KEYS + ("BASE_URL",)
SMTP_KEYS = ("SMTP_HOST", "SMTP_PORT") + tuple(
    f"MAIL_{account}_PASS" for account in ACCOUNT_TYPES
)


def read_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = (part.strip() for part in line.split("=", 1))
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        values[key] = value
    return values


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", type=Path, default=ROOT / ".env")
    parser.add_argument(
        "--transport", choices=("cloudflare-email", "legacy-smtp"),
        default="cloudflare-email",
        help="Native Email Service needs sender identities only; SMTP also needs credentials.",
    )
    parser.add_argument(
        "--sync-worker", metavar="WORKER_NAME",
        help="Stage secrets in a new Worker version; this does not deploy the version.",
    )
    parser.add_argument(
        "--activate", action="store_true",
        help="Deploy the secrets to the named staging Worker after it exists.",
    )
    parser.add_argument(
        "--base-url", metavar="HTTPS_URL",
        help="Required with --sync-worker so staging emails link to the correct site.",
    )
    args = parser.parse_args()
    if args.activate and not args.sync_worker:
        parser.error("--activate memerlukan --sync-worker")

    if not args.env_file.is_file():
        parser.error("Local .env file not found")
    values = read_env(args.env_file)
    keys = EMAIL_KEYS + (SMTP_KEYS if args.transport == "legacy-smtp" else ())
    missing = [key for key in keys if not values.get(key) or values[key] == "your-password-here"]
    invalid_senders = [
        key for key in SENDER_KEYS if key.endswith("_USER") and key in values
        and not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", values[key])
    ]
    if missing or invalid_senders:
        print("Setting emel belum lengkap.")
        if missing:
            print("Kosong/placeholder:", ", ".join(missing))
        if invalid_senders:
            print("Alamat tidak sah:", ", ".join(invalid_senders))
        return 1
    if not values["BASE_URL"].startswith("https://"):
        print("BASE_URL untuk emel mesti bermula dengan https://")
        return 1

    print(f"Disahkan: {len(ACCOUNT_TYPES)} identiti penghantar; {len(keys)} setting untuk {args.transport}.")
    if not args.sync_worker:
        print("Semakan sahaja; tiada secret dihantar atau emel dikirim.")
        return 0

    if not args.base_url or not re.fullmatch(r"https://[^\s/]+(?:/[^\s]*)?", args.base_url):
        parser.error("--base-url HTTPS_URL diperlukan apabila menghantar ke Worker")
    values["BASE_URL"] = args.base_url.rstrip("/")

    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{1,61}[a-z0-9]", args.sync_worker):
        parser.error("Nama Worker tidak sah")
    wrangler = shutil.which("wrangler")
    if wrangler:
        command = [wrangler]
    else:
        npx = shutil.which("npx")
        if not npx:
            parser.error("wrangler/npx tidak ditemui dalam PATH")
        command = [npx, "--yes", "wrangler@4"]

    # Pass selected values only through stdin; never write credentials to disk.
    # The default creates a dormant version. --activate targets only the
    # explicitly named staging Worker and publishes the secret set there.
    subcommand = ["secret", "bulk"] if args.activate else ["versions", "secret", "bulk"]
    result = subprocess.run(
        command + subcommand + ["--name", args.sync_worker],
        input=json.dumps({key: values[key] for key in keys}),
        text=True,
        capture_output=True,
        check=False,
    )
    if result.returncode != 0:
        # Wrangler output is deliberately suppressed in case it echoes input.
        print(f"Pemindahan secret gagal (exit {result.returncode}); semak akaun Wrangler secara berasingan.")
        return 1
    if args.activate:
        print(f"{len(keys)} setting disimpan pada Worker staging aktif; tiada emel dikirim.")
    else:
        print(f"{len(keys)} setting disimpan dalam versi Worker baharu; versi itu belum dideploy.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
