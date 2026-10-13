#!/usr/bin/env python3
"""Copy the local uploads tree into a private R2 staging bucket via Wrangler.

The output manifest is private and resumable. This does not make the bucket public.
Missing production-only files must be reconciled before domain cutover.
"""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib
import json
import mimetypes
import os
from pathlib import Path
import subprocess
import time


ROOT = Path(__file__).resolve().parent.parent
UPLOADS = ROOT / "uploads"
DEFAULT_MANIFEST = ROOT / "output/cloudflare/r2-media-upload-manifest.json"
EXCLUDED = {".DS_Store", ".htaccess"}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def save(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".tmp")
    fd = os.open(temporary, os.O_CREAT | os.O_TRUNC | os.O_WRONLY, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as out:
        json.dump(data, out, ensure_ascii=False, indent=2, sort_keys=True)
        out.write("\n")
    temporary.replace(path)


def upload(bucket: str, path: Path, key: str) -> tuple[str, int, str]:
    content_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    command = ["npx", "--yes", "wrangler@4", "r2", "object", "put",
               bucket + "/" + key, "--file", str(path), "--remote", "--force",
               "--content-type", content_type]
    environ = {**os.environ, "PATH": "/opt/homebrew/opt/node@22/bin:" + os.environ.get("PATH", "")}
    for attempt in range(3):
        result = subprocess.run(command, env=environ, capture_output=True, text=True)
        if result.returncode == 0:
            return key, path.stat().st_size, sha256(path)
        time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"R2 upload failed after 3 attempts: {key}; {result.stderr[-300:]}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bucket", required=True)
    parser.add_argument("--jobs", type=int, default=6)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    args = parser.parse_args()
    if not (1 <= args.jobs <= 12):
        parser.error("--jobs must be between 1 and 12")
    if not UPLOADS.is_dir():
        parser.error("uploads/ is missing")
    records: dict = {"bucket": args.bucket, "files": {}, "errors": {}}
    if args.manifest.exists():
        records = json.loads(args.manifest.read_text(encoding="utf-8"))
        if records["bucket"] != args.bucket:
            parser.error("manifest is for a different R2 bucket")

    files = sorted(path for path in UPLOADS.rglob("*") if path.is_file()
                   and path.name not in EXCLUDED and not path.is_symlink())
    pending = []
    for path in files:
        key = path.relative_to(UPLOADS).as_posix()
        prior = records["files"].get(key)
        if prior and prior.get("size") == path.stat().st_size and prior.get("sha256") == sha256(path):
            continue
        pending.append((path, key))
    print(f"R2 source: {len(files)} files; pending: {len(pending)}", flush=True)
    with ThreadPoolExecutor(max_workers=args.jobs) as executor:
        futures = {executor.submit(upload, args.bucket, path, key): key for path, key in pending}
        completed = 0
        for future in as_completed(futures):
            key = futures[future]
            try:
                _, size, digest = future.result()
                records["files"][key] = {"size": size, "sha256": digest}
                records["errors"].pop(key, None)
            except Exception as exc:
                records["errors"][key] = str(exc)
            completed += 1
            if completed % 20 == 0 or completed == len(pending):
                save(args.manifest, records)
                print(f"R2 progress: {completed}/{len(pending)}; errors: {len(records['errors'])}", flush=True)
    save(args.manifest, records)
    print(f"R2 complete: {len(records['files'])}/{len(files)} local media files; errors: {len(records['errors'])}")
    return 0 if len(records["files"]) == len(files) and not records["errors"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
