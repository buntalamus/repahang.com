#!/usr/bin/env python3
"""Write a private, ordered D1-compatible SQL file from a validated snapshot."""

from __future__ import annotations

import argparse
import os
import sqlite3
from pathlib import Path


MAX_STATEMENT_BYTES = 100_000


def quote(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def literal(value: object) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bytes):
        return "X'" + value.hex() + "'"
    if isinstance(value, (int, float)):
        return str(value)
    string = str(value)
    if "\x00" in string:
        return "CAST(X'" + string.encode("utf-8").hex() + "' AS TEXT)"
    return "'" + string.replace("'", "''") + "'"


def ordered_tables(db: sqlite3.Connection) -> list[str]:
    names = [row[0] for row in db.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    )]
    dependencies = {
        table: {row[2] for row in db.execute("PRAGMA foreign_key_list(" + quote(table) + ")")}
        for table in names
    }
    order: list[str] = []
    while dependencies:
        ready = sorted(table for table, parents in dependencies.items()
                       if not (parents & dependencies.keys()))
        if not ready:
            raise RuntimeError("Foreign-key cycle needs a reviewed import strategy")
        for table in ready:
            order.append(table)
            del dependencies[table]
    return order


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--snapshot", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        parser.error("Output already exists; use a new path")
    db = sqlite3.connect(f"file:{args.snapshot}?mode=ro", uri=True)
    order = ordered_tables(db)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(args.output, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    counts = {}
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as out:
            out.write("-- Private RefPahang D1 staging snapshot; contains personal data.\n")
            out.write("-- Generated from validated SQLite copy of the chosen MySQL dump.\n")
            for table in order:
                schema = db.execute(
                    "SELECT sql FROM sqlite_master WHERE type='table' AND name=?", (table,)
                ).fetchone()[0]
                out.write(schema + ";\n")
            for table in order:
                columns = [row[1] for row in db.execute("PRAGMA table_info(" + quote(table) + ")")]
                prefix = "INSERT INTO " + quote(table) + " (" + ", ".join(map(quote, columns)) + ") VALUES ("
                counts[table] = 0
                for row in db.execute("SELECT * FROM " + quote(table)):
                    statement = prefix + ", ".join(map(literal, row)) + ");\n"
                    if len(statement.encode("utf-8")) > MAX_STATEMENT_BYTES:
                        raise RuntimeError(f"D1 statement exceeds {MAX_STATEMENT_BYTES} bytes in {table}")
                    out.write(statement)
                    counts[table] += 1
            for (schema,) in db.execute(
                "SELECT sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL ORDER BY name"
            ):
                out.write(schema + ";\n")
    except BaseException:
        args.output.unlink(missing_ok=True)
        raise
    finally:
        db.close()
    print(f"D1 SQL prepared: {len(order)} tables, {sum(counts.values())} rows, {args.output.stat().st_size} bytes")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
