#!/usr/bin/env python3
"""Merge the audited Hanafi recovery into a fresh, private D1 snapshot.

The new MySQL dump is authoritative for every existing row. Only Hanafi's
missing 2026 matches are inserted. A recovered ID that is now occupied by a
real match receives a new ID above the fresh dump's maximum. No source file is
modified, and no personal data is printed or written to the manifest.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sqlite3
from pathlib import Path


RECOVERY_USER_ID = 80
RECOVERY_YEAR = 2026
EXPECTED_RECOVERED = 51


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def tables(db: sqlite3.Connection) -> list[str]:
    return [row[0] for row in db.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    )]


def columns(db: sqlite3.Connection, table: str) -> list[str]:
    return [row[1] for row in db.execute(f'PRAGMA table_info("{table}")')]


def quote(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def count_matches(db: sqlite3.Connection) -> int:
    return db.execute("""
        SELECT COUNT(*) FROM perlawanan WHERE user_id=?
          AND tarikh>=? AND tarikh<?
    """, (RECOVERY_USER_ID, f"{RECOVERY_YEAR}-01-01", f"{RECOVERY_YEAR+1}-01-01"))\
        .fetchone()[0]


def write_manifest(path: Path, data: dict) -> None:
    fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as out:
        json.dump(data, out, indent=2, sort_keys=True)
        out.write("\n")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fresh", required=True, type=Path,
                        help="SQLite snapshot converted from the latest MySQL dump")
    parser.add_argument("--recovered", required=True, type=Path,
                        help="Audited earlier SQLite snapshot containing 51 Hanafi matches")
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--manifest", required=True, type=Path)
    args = parser.parse_args()
    if args.output.exists() or args.manifest.exists():
        parser.error("Output or manifest already exists; refusing to overwrite private data")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.manifest.parent.mkdir(parents=True, exist_ok=True)
    old = sqlite3.connect(f"file:{args.recovered}?mode=ro", uri=True)
    fresh = sqlite3.connect(f"file:{args.fresh}?mode=ro", uri=True)
    destination = None
    try:
        fresh_tables = tables(fresh)
        if fresh_tables != tables(old):
            raise RuntimeError("Source table sets differ; review the schema before merging")
        for table in fresh_tables:
            if columns(fresh, table) != columns(old, table):
                raise RuntimeError(f"Source columns differ in {table}")
        if old.execute('SELECT no_ic,email FROM users WHERE id=?',
                       (RECOVERY_USER_ID,)).fetchone() != fresh.execute(
                           'SELECT no_ic,email FROM users WHERE id=?',
                           (RECOVERY_USER_ID,)).fetchone():
            raise RuntimeError("Recovered user identity does not match the fresh dump")
        if count_matches(old) != EXPECTED_RECOVERED or count_matches(fresh) != 0:
            raise RuntimeError("Unexpected Hanafi 2026 source counts; review manually")
        source_rows = old.execute("""
            SELECT * FROM perlawanan WHERE user_id=? AND tarikh>=? AND tarikh<?
            ORDER BY id
        """, (RECOVERY_USER_ID, f"{RECOVERY_YEAR}-01-01",
              f"{RECOVERY_YEAR+1}-01-01")).fetchall()
        match_columns = columns(old, "perlawanan")
        id_index = match_columns.index("id")
        user_index = match_columns.index("user_id")
        application_index = match_columns.index("permohonan_id")
        status_index = match_columns.index("status_pp")
        if (len({row[id_index] for row in source_rows}) != EXPECTED_RECOVERED or
                any(row[user_index] != RECOVERY_USER_ID or
                    row[application_index] is not None or
                    row[status_index] != "Disahkan" for row in source_rows)):
            raise RuntimeError("Recovered match identity or approval state changed")

        fd = os.open(args.output, os.O_CREAT | os.O_EXCL | os.O_RDWR, 0o600)
        os.close(fd)
        destination = sqlite3.connect(args.output)
        fresh.backup(destination)
        before_total = sum(destination.execute(f'SELECT COUNT(*) FROM "{t}"').fetchone()[0]
                           for t in fresh_tables)
        occupied = {row[0] for row in destination.execute("SELECT id FROM perlawanan")}
        next_id = max(occupied) + 1
        remapped: dict[int, int] = {}
        placeholders = ",".join("?" for _ in match_columns)
        insert = ("INSERT INTO perlawanan (" + ",".join(map(quote, match_columns))
                  + f") VALUES ({placeholders})")
        destination.execute("BEGIN")
        for source in source_rows:
            values = list(source)
            original_id = values[id_index]
            if original_id in occupied:
                values[id_index] = next_id
                remapped[original_id] = next_id
                next_id += 1
            destination.execute(insert, values)
            occupied.add(values[id_index])
        destination.commit()
        if count_matches(destination) != EXPECTED_RECOVERED:
            raise RuntimeError("Merged Hanafi match count is not 51")
        if destination.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
            raise RuntimeError("Merged SQLite integrity check failed")
        if destination.execute("PRAGMA foreign_key_check").fetchone() is not None:
            raise RuntimeError("Merged SQLite foreign key check failed")
        after_total = sum(destination.execute(f'SELECT COUNT(*) FROM "{t}"').fetchone()[0]
                          for t in fresh_tables)
        if after_total != before_total + EXPECTED_RECOVERED:
            raise RuntimeError("Unexpected row count after recovery")
        manifest = {
            "fresh_snapshot_sha256": sha256(args.fresh),
            "recovery_snapshot_sha256": sha256(args.recovered),
            "merged_snapshot_sha256": sha256(args.output),
            "tables": len(fresh_tables),
            "fresh_rows": before_total,
            "merged_rows": after_total,
            "fresh_matches": len(occupied) - EXPECTED_RECOVERED,
            "merged_matches": len(occupied),
            "hanafi_2026_matches": EXPECTED_RECOVERED,
            "remapped_match_ids": remapped,
            "application_535_recreated": False,
            "source_limitations": "13 PDF-derived matches retain unknown original details; do not invent them.",
        }
        write_manifest(args.manifest, manifest)
        print(f"Merged {len(fresh_tables)} tables and {after_total} rows; "
              f"Hanafi 2026={EXPECTED_RECOVERED}, remapped IDs={len(remapped)}")
        return 0
    except BaseException:
        args.output.unlink(missing_ok=True)
        args.manifest.unlink(missing_ok=True)
        raise
    finally:
        if destination is not None:
            destination.close()
        fresh.close()
        old.close()


if __name__ == "__main__":
    raise SystemExit(main())
