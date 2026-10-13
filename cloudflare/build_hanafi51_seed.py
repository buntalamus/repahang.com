#!/usr/bin/env python3
"""Build private MySQL and D1 staging seeds with Hanafi's 51 restored matches.

Requires a local MySQL server binary/client, mysqldump, and mysql-connector-python.
Only an isolated temporary MySQL instance is started; no production connection.
"""

from __future__ import annotations

import hashlib
import json
import os
import sqlite3
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "output/cloudflare"
SOURCES = {
    ROOT / "refpahan_refpahang-3.sql": "e9b2919f76e3112037b6c94d725f1f7d37db1f6510b4fe0e0d941104de1d7575",
    ROOT / "output/recovery/restore_hanafi_535_01_dump_38_preview.sql": "66293ecea0a71764f60d3314780ad3f7dfa1632448753a048a9348be812e9027",
    ROOT / "output/recovery/restore_hanafi_535_02_pdf_13_preview.sql": "ac6cb8ddd966cfce6910e913b48ac835f2ef50a2e0b416d0fbeec245a16b13af",
}
TARGET = "refpahang_2026-10-13_hanafi51"
COUNT_SQL = ("SELECT COUNT(*), COUNT(DISTINCT id), "
             "COALESCE(SUM(status_pp='Disahkan'),0), COALESCE(SUM(permohonan_id IS NULL),0) "
             "FROM perlawanan WHERE user_id=80 "
             "AND tarikh>='2026-01-01' AND tarikh<'2027-01-01'")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def run(args: list[str], *, input_path: Path | None = None,
        output_path: Path | None = None) -> str:
    with (input_path.open("rb") if input_path else open(os.devnull, "rb")) as stdin:
        if output_path:
            fd = os.open(output_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
            with os.fdopen(fd, "wb") as stdout:
                subprocess.run(args, stdin=stdin, stdout=stdout, check=True)
            return ""
        return subprocess.run(args, stdin=stdin, stdout=subprocess.PIPE,
                              check=True, text=True).stdout


def main() -> int:
    for path, expected in SOURCES.items():
        if sha256(path) != expected:
            raise RuntimeError(f"Unexpected source hash: {path.name}")
    OUT.mkdir(parents=True, exist_ok=True)
    mysql_seed = OUT / f"{TARGET}_mysql.sql"
    sqlite_seed = OUT / f"{TARGET}.sqlite"
    d1_seed = OUT / f"{TARGET}_d1.sql"
    manifest = OUT / f"{TARGET}_manifest.json"
    bundle = OUT / f"{TARGET}_bundle.zip"
    for path in (mysql_seed, sqlite_seed, d1_seed, manifest, bundle):
        if path.exists():
            raise RuntimeError(f"Output exists; refusing to overwrite: {path}")

    with tempfile.TemporaryDirectory(prefix="refpahang-hanafi51-") as tmp_name:
        tmp = Path(tmp_name)
        data = tmp / "data"
        socket = tmp / "mysql.sock"
        data.mkdir(mode=0o700)
        run(["mysqld", "--initialize-insecure", f"--datadir={data}"])
        subprocess.run(["mysqld", "--daemonize", f"--datadir={data}",
                        f"--socket={socket}", "--skip-networking",
                        f"--pid-file={tmp / 'mysql.pid'}",
                        f"--log-error={tmp / 'mysql.log'}"], check=True)
        mysql = ["mysql", f"--socket={socket}", "-uroot", "--batch", "--skip-column-names"]

        def query(database: str, sql: str) -> str:
            return run(mysql + [f"--database={database}", "-e", sql]).strip()

        def verify(database: str, expected: int) -> None:
            fields = query(database, COUNT_SQL).split("\t")
            if fields != [str(expected)] * 4:
                raise RuntimeError(f"Hanafi 2026 count mismatch in {database}: {fields}")

        try:
            run(mysql + ["-e", "CREATE DATABASE refpahang_seed CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"])
            run(mysql + ["--database=refpahang_seed"], input_path=next(iter(SOURCES)))
            verify("refpahang_seed", 0)

            for stage, expected in ((1, 38), (2, 51)):
                source = list(SOURCES)[stage]
                sql = source.read_text(encoding="utf-8")
                before = "SET @apply_hanafi_535 = 0;"
                if sql.count(before) != 1:
                    raise RuntimeError(f"Unexpected apply switch in stage {stage}")
                staged = tmp / f"stage{stage}.sql"
                staged.write_text(sql.replace(before, "SET @apply_hanafi_535 = 1;"), encoding="utf-8")
                result = run(mysql + ["--database=refpahang_seed"], input_path=staged)
                if f"\t{expected}\n" not in result and not result.rstrip().endswith(f"\t{expected}"):
                    raise RuntimeError(f"Stage {stage} did not report {expected} matches")
                verify("refpahang_seed", expected)
                print(f"MySQL recovery stage {stage}: {expected} Hanafi matches")

            run(["mysqldump", f"--socket={socket}", "-uroot", "--single-transaction",
                 "--default-character-set=utf8mb4", "--hex-blob", "--no-tablespaces",
                 "--set-gtid-purged=OFF",
                 "refpahang_seed"], output_path=mysql_seed)

            # A clean reimport proves the combined dump stands on its own.
            run(mysql + ["-e", "CREATE DATABASE refpahang_reimport CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"])
            run(mysql + ["--database=refpahang_reimport"], input_path=mysql_seed)
            verify("refpahang_reimport", 51)
            source_counts = query("refpahang_seed", "SELECT COUNT(*) FROM perlawanan")
            if query("refpahang_reimport", "SELECT COUNT(*) FROM perlawanan") != source_counts:
                raise RuntimeError("Combined dump lost match rows on reimport")
            print("Combined MySQL dump reimport: 51 Hanafi matches")

            run([sys.executable, str(ROOT / "cloudflare/mysql_to_d1_snapshot.py"),
                 "--database", "refpahang_reimport", "--socket", str(socket),
                 "--output", str(sqlite_seed)])
            run([sys.executable, str(ROOT / "cloudflare/sqlite_to_d1_sql.py"),
                 "--snapshot", str(sqlite_seed), "--output", str(d1_seed)])

            with sqlite3.connect(f"file:{sqlite_seed}?mode=ro", uri=True) as db:
                rows = db.execute(COUNT_SQL).fetchone()
                if rows != (51, 51, 51, 51):
                    raise RuntimeError(f"D1 snapshot Hanafi count mismatch: {rows}")
                if db.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
                    raise RuntimeError("SQLite integrity check failed")
                if db.execute("PRAGMA foreign_key_check").fetchone() is not None:
                    raise RuntimeError("SQLite foreign key check failed")
                tables = [row[0] for row in db.execute(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")]
                total = sum(db.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]
                            for table in tables)
                if len(tables) != 40 or total != 58657:
                    raise RuntimeError(f"Unexpected D1 table/row count: {len(tables)}/{total}")

            private_manifest = {
                "source_mysql_sha256": SOURCES[next(iter(SOURCES))],
                "recovery_stage_sha256": [SOURCES[path] for path in list(SOURCES)[1:]],
                "combined_mysql_sha256": sha256(mysql_seed),
                "d1_sql_sha256": sha256(d1_seed),
                "mysql_file": mysql_seed.name,
                "sqlite_file": sqlite_seed.name,
                "d1_file": d1_seed.name,
                "tables": 40,
                "rows": 58657,
                "perlawanan_rows": int(source_counts),
                "hanafi_2026_matches": 51,
                "hanafi_sources": {"mysql_backup_2026_08_27": 38, "pdf_2026_10_13": 13},
                "application_535_recreated": False,
                "limitations": "PDF rows lack unavailable IDs, scores, teams and approval details; this is a staging copy, not live production."
            }
            fd = os.open(manifest, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
            with os.fdopen(fd, "w", encoding="utf-8") as out:
                json.dump(private_manifest, out, ensure_ascii=False, indent=2)
                out.write("\n")
            fd = os.open(bundle, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
            with os.fdopen(fd, "wb") as out, zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED,
                                                               compresslevel=6) as archive:
                for path in (mysql_seed, d1_seed, manifest,
                             ROOT / "output/recovery/hanafi_535_perlawanan_2026_audit.csv"):
                    archive.write(path, path.name)
                archive.writestr("README.txt", "MySQL gabungan dan SQL D1 untuk STAGING sahaja. "
                                 "Kedua-duanya mempunyai 51 perlawanan Hanafi tahun 2026. "
                                 "Import hanya fail yang sepadan dengan pangkalan sasaran; "
                                 "jangan import kedua-duanya ke pangkalan yang sama. "
                                 "Lihat docs/cloudflare_migration_prep.md. "
                                 "Permohonan #535 tidak dipulihkan.\n")
            with zipfile.ZipFile(bundle) as archive:
                if archive.testzip() is not None:
                    raise RuntimeError("Seed bundle ZIP integrity failed")
            print(f"Prepared private MySQL/D1 seeds: {len(tables)} tables, {total} rows, Hanafi 2026={rows[0]}")
        except BaseException:
            for path in (mysql_seed, sqlite_seed, d1_seed, manifest, bundle):
                path.unlink(missing_ok=True)
            raise
        finally:
            subprocess.run(["mysqladmin", f"--socket={socket}", "-uroot", "shutdown"],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
