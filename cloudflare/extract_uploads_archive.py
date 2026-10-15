#!/usr/bin/env python3
"""Safely extract a user-supplied uploads ZIP into a private staging folder."""

from __future__ import annotations

import argparse
import os
from pathlib import Path, PurePosixPath
import shutil
import zipfile


MEDIA_EXTENSIONS = {".jpg", ".jpeg", ".png", ".pdf", ".jfif"}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--root", default="uploads-2",
                        help="Top-level directory in the ZIP")
    args = parser.parse_args()
    if args.output.exists():
        parser.error("Output exists; refusing to overwrite private media")
    count = 0
    total_bytes = 0
    try:
        args.output.mkdir(mode=0o700, parents=True)
        with zipfile.ZipFile(args.archive) as archive:
            for item in archive.infolist():
                if item.is_dir() or item.filename.startswith("__MACOSX/"):
                    continue
                prefix = args.root.rstrip("/") + "/"
                if not item.filename.startswith(prefix):
                    raise ValueError("Unexpected ZIP root")
                key = item.filename[len(prefix):]
                parts = PurePosixPath(key).parts
                if not parts or key.startswith("/") or any(part in (".", "..") for part in parts):
                    raise ValueError("Unsafe ZIP path")
                if key == ".htaccess":
                    continue  # Server configuration must never be served as media.
                if PurePosixPath(key).suffix.lower() not in MEDIA_EXTENSIONS:
                    raise ValueError("Unexpected media file extension")
                if ((item.external_attr >> 16) & 0o170000) == 0o120000:
                    raise ValueError("Symlink in ZIP")
                destination = args.output.joinpath(*parts)
                destination.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
                fd = os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
                with os.fdopen(fd, "wb") as out, archive.open(item) as source:
                    shutil.copyfileobj(source, out, 1024 * 1024)
                if destination.stat().st_size != item.file_size:
                    raise ValueError("ZIP extraction size mismatch")
                count += 1
                total_bytes += item.file_size
    except BaseException:
        shutil.rmtree(args.output, ignore_errors=True)
        raise
    print(f"Extracted {count} private media files ({total_bytes} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
