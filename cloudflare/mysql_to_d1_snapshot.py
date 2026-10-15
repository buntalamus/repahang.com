#!/usr/bin/env python3
"""Convert an imported MySQL dump into a private SQLite/D1 staging snapshot.

This copies schema, data, indexes, declared foreign keys, column defaults
(CURRENT_TIMESTAMP becomes Malaysia time) and case-insensitive collation:
utf8mb4_*_ci text columns become COLLATE NOCASE so comparisons, GROUP BY,
DISTINCT and ORDER BY ignore ASCII case like MySQL. NOCASE does not ignore
accents or trailing spaces. It does not port application SQL, ENUM validation
or transaction behaviour.
Do not use the resulting file for production cutover without those reviews.
"""

from __future__ import annotations

import argparse
import datetime as dt
import decimal
import json
import os
import sqlite3
from pathlib import Path

import mysql.connector


INTEGER_TYPES = {"tinyint", "smallint", "mediumint", "int", "integer", "bigint", "bit"}
REAL_TYPES = {"float", "double", "real"}
BLOB_TYPES = {"binary", "varbinary", "tinyblob", "blob", "mediumblob", "longblob"}


def quote(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def mysql_quote(name: str) -> str:
    return "`" + name.replace("`", "``") + "`"


def sqlite_type(data_type: str) -> str:
    if data_type in INTEGER_TYPES:
        return "INTEGER"
    if data_type in REAL_TYPES:
        return "REAL"
    if data_type in BLOB_TYPES:
        return "BLOB"
    # DECIMAL stays text to retain exact digits. Dates/JSON/ENUM stay text.
    return "TEXT"


def column_default(column: dict) -> str:
    """SQLite DEFAULT clause equivalent to the MySQL column default."""
    default = column.get("column_default")
    if isinstance(default, (bytes, bytearray)):
        default = bytes(default).decode("utf-8")
    if default is None:
        return ""
    extra = str(column.get("extra") or "").upper()
    text = str(default)
    if "DEFAULT_GENERATED" in extra or text.upper().startswith("CURRENT_TIMESTAMP"):
        if text.upper().startswith("CURRENT_TIMESTAMP") or text.upper() == "NOW()":
            return " DEFAULT (datetime('now','+8 hours'))"
        raise RuntimeError(f"Unsupported generated default {column['table_name']}.{column['column_name']}: {text}")
    if sqlite_type(column["data_type"]) in ("INTEGER", "REAL"):
        float(text)
        return " DEFAULT " + text
    return " DEFAULT '" + text.replace("'", "''") + "'"


def text_collation(column: dict) -> str:
    collation = str(column.get("collation_name") or "")
    if sqlite_type(column["data_type"]) == "TEXT" and collation.endswith("_ci"):
        return " COLLATE NOCASE"
    return ""


def normalize(value: object, data_type: str) -> object:
    if isinstance(value, (bytes, bytearray)):
        raw = bytes(value)
        if data_type in BLOB_TYPES:
            return raw
        if data_type == "bit":
            return int.from_bytes(raw, "big")
        return raw.decode("utf-8")
    if isinstance(value, decimal.Decimal):
        return str(value)
    if isinstance(value, (dt.datetime, dt.date, dt.time)):
        return value.isoformat(sep=" ") if isinstance(value, dt.datetime) else value.isoformat()
    if isinstance(value, dt.timedelta):
        return str(value)
    if isinstance(value, bytearray):
        return bytes(value)
    return value


def fetch_dicts(cursor, query: str, args: tuple[object, ...]) -> list[dict]:
    cursor.execute(query, args)
    return [{key.lower(): value for key, value in row.items()} for row in cursor.fetchall()]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", required=True, help="Isolated MySQL database imported from the source dump")
    parser.add_argument("--socket", help="Local MySQL Unix socket")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=3306)
    parser.add_argument("--user", default="root")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    connection_args = {"user": args.user, "database": args.database, "charset": "utf8mb4"}
    if args.socket:
        connection_args["unix_socket"] = args.socket
    else:
        connection_args.update({"host": args.host, "port": args.port})
    password = os.environ.get("MYSQL_PWD")
    if password is not None:
        connection_args["password"] = password
    mysql_conn = mysql.connector.connect(**connection_args)
    meta = mysql_conn.cursor(dictionary=True)

    tables = fetch_dicts(meta, """
        SELECT table_name FROM information_schema.tables
        WHERE table_schema=%s AND table_type='BASE TABLE' ORDER BY table_name
    """, (args.database,))
    columns = fetch_dicts(meta, """
        SELECT table_name,column_name,data_type,is_nullable,ordinal_position,
               collation_name,column_default,extra
        FROM information_schema.columns WHERE table_schema=%s
        ORDER BY table_name,ordinal_position
    """, (args.database,))
    keys = fetch_dicts(meta, """
        SELECT table_name,column_name,ordinal_position
        FROM information_schema.key_column_usage
        WHERE table_schema=%s AND constraint_name='PRIMARY'
        ORDER BY table_name,ordinal_position
    """, (args.database,))
    foreign_keys = fetch_dicts(meta, """
        SELECT k.table_name,k.constraint_name,k.column_name,k.referenced_table_name,
               k.referenced_column_name,k.ordinal_position,r.delete_rule,r.update_rule
        FROM information_schema.key_column_usage k
        JOIN information_schema.referential_constraints r
          ON r.constraint_schema=k.constraint_schema
         AND r.table_name=k.table_name AND r.constraint_name=k.constraint_name
        WHERE k.table_schema=%s AND k.referenced_table_name IS NOT NULL
        ORDER BY k.table_name,k.constraint_name,k.ordinal_position
    """, (args.database,))
    indexes = fetch_dicts(meta, """
        SELECT table_name,index_name,column_name,seq_in_index,non_unique,sub_part
        FROM information_schema.statistics
        WHERE table_schema=%s AND index_name<>'PRIMARY'
        ORDER BY table_name,index_name,seq_in_index
    """, (args.database,))

    by_table: dict[str, list[dict]] = {}
    for column in columns:
        by_table.setdefault(column["table_name"], []).append(column)
    primary: dict[str, list[str]] = {}
    for key in keys:
        primary.setdefault(key["table_name"], []).append(key["column_name"])
    grouped_fk: dict[tuple[str, str], list[dict]] = {}
    for fk in foreign_keys:
        grouped_fk.setdefault((fk["table_name"], fk["constraint_name"]), []).append(fk)
    grouped_index: dict[tuple[str, str], list[dict]] = {}
    for index in indexes:
        if index["column_name"] is None or index["sub_part"] is not None:
            raise RuntimeError("Unsupported expression or prefix index")
        grouped_index.setdefault((index["table_name"], index["index_name"]), []).append(index)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    temporary = args.output.with_name(args.output.name + ".tmp")
    if temporary.exists() or args.output.exists():
        raise RuntimeError("Output already exists; use a new path to avoid overwriting private data")
    fd = os.open(temporary, os.O_CREAT | os.O_EXCL | os.O_RDWR, 0o600)
    os.close(fd)
    db = sqlite3.connect(temporary)
    summary: dict[str, object] = {"tables": {}, "max_cell_bytes": 0, "max_row_bytes": 0}
    try:
        db.execute("PRAGMA foreign_keys=OFF")
        db.execute("BEGIN")
        for record in tables:
            table = record["table_name"]
            table_columns = by_table[table]
            pk = primary.get(table, [])
            inline_pk = len(pk) == 1 and sqlite_type(next(
                column["data_type"] for column in table_columns if column["column_name"] == pk[0]
            )) == "INTEGER"
            definitions = []
            for column in table_columns:
                part = (quote(column["column_name"]) + " " + sqlite_type(column["data_type"])
                        + text_collation(column))
                if inline_pk and column["column_name"] == pk[0]:
                    part += " PRIMARY KEY"
                elif column["is_nullable"] == "NO":
                    part += " NOT NULL"
                if not (inline_pk and column["column_name"] == pk[0]):
                    part += column_default(column)
                definitions.append(part)
            if pk and not inline_pk:
                definitions.append("PRIMARY KEY (" + ", ".join(map(quote, pk)) + ")")
            for (fk_table, _), parts in grouped_fk.items():
                if fk_table != table:
                    continue
                child = ", ".join(quote(part["column_name"]) for part in parts)
                parent = ", ".join(quote(part["referenced_column_name"]) for part in parts)
                first = parts[0]
                definitions.append(
                    "FOREIGN KEY (" + child + ") REFERENCES "
                    + quote(first["referenced_table_name"]) + " (" + parent + ")"
                    + " ON DELETE " + first["delete_rule"]
                    + " ON UPDATE " + first["update_rule"]
                )
            db.execute("CREATE TABLE " + quote(table) + " (" + ", ".join(definitions) + ")")

        # Raw rows preserve MySQL zero dates, which connector's typed cursor
        # turns into None even when the source column is NOT NULL.
        data_cursor = mysql_conn.cursor(buffered=False, raw=True)
        for record in tables:
            table = record["table_name"]
            column_names = [column["column_name"] for column in by_table[table]]
            insert_sql = (
                "INSERT INTO " + quote(table) + " (" + ", ".join(map(quote, column_names)) + ")"
                + " VALUES (" + ", ".join("?" for _ in column_names) + ")"
            )
            data_cursor.execute("SELECT * FROM " + mysql_quote(table))
            count = 0
            while True:
                batch = data_cursor.fetchmany(500)
                if not batch:
                    break
                normalized = []
                for row in batch:
                    values = tuple(
                        normalize(value, column["data_type"])
                        for value, column in zip(row, by_table[table])
                    )
                    sizes = [len(value) if isinstance(value, bytes) else len(str(value).encode("utf-8"))
                             for value in values if value is not None]
                    summary["max_cell_bytes"] = max(summary["max_cell_bytes"], *sizes, 0)
                    summary["max_row_bytes"] = max(summary["max_row_bytes"], sum(sizes))
                    normalized.append(values)
                db.executemany(insert_sql, normalized)
                count += len(normalized)
            summary["tables"][table] = count

        for (table, name), parts in grouped_index.items():
            unique = "UNIQUE " if parts[0]["non_unique"] == 0 else ""
            index_name = f"idx_{table}_{name}"
            db.execute(
                "CREATE " + unique + "INDEX " + quote(index_name)
                + " ON " + quote(table) + " ("
                + ", ".join(quote(part["column_name"]) for part in parts) + ")"
            )
        db.commit()
        integrity = db.execute("PRAGMA integrity_check").fetchone()[0]
        fk_errors = db.execute("PRAGMA foreign_key_check").fetchall()
        summary.update({
            "table_count": len(tables),
            "row_count": sum(summary["tables"].values()),
            "foreign_key_count": len(grouped_fk),
            "index_count": len(grouped_index),
            "integrity_check": integrity,
            "foreign_key_errors": len(fk_errors),
        })
        if integrity != "ok" or fk_errors:
            raise RuntimeError(f"Snapshot integrity failed: integrity={integrity}, foreign_keys={len(fk_errors)}")
    except BaseException:
        db.close()
        temporary.unlink(missing_ok=True)
        raise
    finally:
        data_cursor = locals().get("data_cursor")
        if data_cursor is not None:
            try:
                data_cursor.close()
            except mysql.connector.Error:
                pass
        meta.close()
        mysql_conn.close()
    db.close()
    temporary.replace(args.output)
    print(json.dumps(summary, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
