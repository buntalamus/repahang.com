#!/usr/bin/env python3
"""Recover DB-referenced /uploads images absent from the local copy.

Only paths already present in the SQLite snapshot are requested, from one
explicit HTTPS origin. Downloads stay under ignored output/cloudflare/ and are
uploaded to the private R2 staging bucket with the original object key.
"""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
import os
from pathlib import Path, PurePosixPath
import sqlite3
import urllib.error
import urllib.parse
import urllib.request

from sync_media import ROOT, UPLOADS, save, sha256, upload


REFERENCES = {
    "jadual_perlawanan": ("logo_home", "logo_away"),
    "kejohanan": ("logo_kiri", "logo_kanan"),
    "pasukan": ("logo_path",),
    "pasukan_logo": ("logo_path",),
    "penilai_permohonan": ("sijil_kursus_url", "sijil_kesihatan_url"),
    "permohonan": ("url_resit", "url_gambar_profil", "payment_receipt_url"),
    "permohonan_pp": ("resit_pembayaran_path", "resit_path"),
    "users": ("url_gambar_profil",),
}
MAX_BYTES = 10 * 1024 * 1024


def missing_keys(snapshot: Path) -> set[str]:
    connection = sqlite3.connect(f"file:{snapshot}?mode=ro", uri=True)
    keys: set[str] = set()
    try:
        for table, columns in REFERENCES.items():
            for column in columns:
                for (value,) in connection.execute(
                    f'SELECT DISTINCT "{column}" FROM "{table}" '
                    f'WHERE "{column}" IS NOT NULL AND "{column}" <> ""'
                ):
                    parsed = urllib.parse.urlparse(value)
                    if parsed.scheme or parsed.netloc:
                        continue  # External documents, including Google Drive.
                    path = urllib.parse.unquote(parsed.path).lstrip("/")
                    if not path.startswith("uploads/"):
                        continue
                    key = path[len("uploads/"):]
                    parts = PurePosixPath(key).parts
                    if not parts or any(part in (".", "..") for part in parts):
                        raise ValueError("Unsafe media path in database snapshot")
                    if not (UPLOADS / key).is_file():
                        keys.add(key)
    finally:
        connection.close()
    return keys


def valid_media(body: bytes, content_type: str) -> bool:
    if content_type.startswith("image/"):
        return body.startswith((b"\x89PNG\r\n\x1a\n", b"\xff\xd8\xff", b"GIF87a", b"GIF89a")) or (
            body.startswith(b"RIFF") and body[8:12] == b"WEBP"
        )
    return content_type == "application/pdf" and body.startswith(b"%PDF-")


def recover(origin: str, bucket: str, directory: Path, key: str) -> dict:
    url = origin + "/uploads/" + urllib.parse.quote(key, safe="/")
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(request, timeout=30) as response:
        content_type = response.headers.get_content_type().lower()
        body = response.read(MAX_BYTES + 1)
    if len(body) > MAX_BYTES or not valid_media(body, content_type):
        raise ValueError("Source is oversized or is not a recognized image/PDF")
    destination = directory / key
    destination.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "wb") as out:
        out.write(body)
    _, size, digest = upload(bucket, destination, key)
    return {"size": size, "sha256": digest, "source": url}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--snapshot", type=Path, required=True)
    parser.add_argument("--bucket", required=True)
    parser.add_argument("--origin", default="https://refpahang.com")
    parser.add_argument("--jobs", type=int, default=6)
    args = parser.parse_args()
    if not args.snapshot.is_file():
        parser.error("SQLite snapshot not found")
    if not args.origin.startswith("https://") or "/" in args.origin[8:]:
        parser.error("--origin must be a single HTTPS origin")
    if not (1 <= args.jobs <= 12):
        parser.error("--jobs must be between 1 and 12")

    keys = missing_keys(args.snapshot)
    directory = ROOT / "output/cloudflare/recovered_media"
    manifest_path = ROOT / "output/cloudflare/recovered-media-manifest.json"
    manifest = {"origin": args.origin, "bucket": args.bucket, "files": {}, "errors": {}}
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        if (manifest["origin"], manifest["bucket"]) != (args.origin, args.bucket):
            parser.error("Existing manifest has another origin/bucket")
    pending = [key for key in sorted(keys) if not (
        key in manifest["files"]
        and (directory / key).is_file()
        and sha256(directory / key) == manifest["files"][key]["sha256"]
    )]
    print(f"Missing local media: {len(keys)}; pending recovery: {len(pending)}", flush=True)
    with ThreadPoolExecutor(max_workers=args.jobs) as executor:
        futures = {executor.submit(recover, args.origin, args.bucket, directory, key): key for key in pending}
        for index, future in enumerate(as_completed(futures), 1):
            key = futures[future]
            try:
                manifest["files"][key] = future.result()
                manifest["errors"].pop(key, None)
            except urllib.error.HTTPError as exc:
                manifest["errors"][key] = f"HTTP {exc.code}"
            except Exception as exc:
                manifest["errors"][key] = type(exc).__name__
            if index % 10 == 0 or index == len(pending):
                save(manifest_path, manifest)
                print(f"Recovery progress: {index}/{len(pending)}; errors: {len(manifest['errors'])}", flush=True)
    save(manifest_path, manifest)
    print(f"Recovered: {len(manifest['files'])}/{len(keys)}; errors: {len(manifest['errors'])}")
    return 0 if len(manifest["files"]) == len(keys) and not manifest["errors"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
