#!/usr/bin/env python3
"""Build the fictional database for demo.refpahang.com.

Only the schema is taken from a private snapshot. Rows are copied from the
reference tables (districts, associations, application settings) and every
person, tournament, match, appointment, report and application is generated
here, deterministically. Nobody in the output is a real person:

* email      -> <slug>.<n>@demo.invalid (shared logins: @demo.refpahang.com)
* IC         -> valid birth date with place code 00 (never issued)
* phone      -> 0000xxxxxx (not dialable)
* Telegram   -> chat ids below DEMO_FAKE_CHAT_CEILING (src/demo.ts), which the
                demo Worker records in demo_outbox instead of sending

The output is the pre-migration base. Import it with sqlite_to_d1_sql.py and
then run `wrangler d1 migrations apply` (docs/demo.md).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import random
import sqlite3
import subprocess
from datetime import date, datetime, timedelta
from pathlib import Path

HERE = Path(__file__).resolve().parent
CLOUDFLARE = HERE.parent
FAKE_CHAT_CEILING = -8_000_000_000_000_000
REFERENCE_TABLES = ["districts", "persatuan_bolasepak_daerah", "application_settings"]
KUP = ["Pengadil", "Penolong Pengadil 1", "Penolong Pengadil 2", "Pegawai ke4"]
HARI = ["Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu", "Ahad"]

rng = random.Random(20261024)

MALE = ["Ahmad", "Muhammad", "Mohd", "Amirul", "Syafiq", "Azlan", "Zulkifli", "Khairul", "Nazri", "Rizal",
        "Firdaus", "Haziq", "Irfan", "Danial", "Aiman", "Shahrul", "Fadzli", "Hakim", "Kamarul", "Roslan",
        "Saiful", "Taufik", "Hafiz", "Faris", "Iskandar", "Luqman", "Naufal", "Asyraf", "Hairi", "Johari"]
SECOND = ["Faiz", "Hakimi", "Izzat", "Adli", "Najmi", "Syukri", "Ridhwan", "Akmal", "Fikri", "Zaki", "Anuar",
          "Hisyam", "Afiq", "Amri", "Shafiq", ""]
FATHER = ["Abdullah", "Ismail", "Rahman", "Hassan", "Yusof", "Osman", "Ibrahim", "Salleh", "Hamid", "Aziz",
          "Kassim", "Daud", "Razak", "Mahmud", "Zakaria", "Sulaiman", "Ghazali", "Jaafar", "Mokhtar", "Rashid"]
FEMALE = ["Nur Aisyah", "Siti Hajar", "Nurul Izzah", "Farah Aqilah", "Nur Syafiqah", "Aina Sofea"]
CHINESE = ["Tan", "Lim", "Wong", "Lee", "Ng", "Chong", "Ong", "Teoh"]
CHINESE_GIVEN = ["Wei Liang", "Chee Keong", "Kah Hoe", "Jun Hao", "Boon Hock", "Kok Wai", "Zhi Hao", "Yong Sheng"]
INDIAN = ["Suresh", "Kumar", "Ganesh", "Ravi", "Prakash", "Vinod", "Dinesh", "Arun"]
INDIAN_FATHER = ["Muthu", "Rajan", "Subramaniam", "Krishnan", "Ramasamy", "Gopal", "Velu", "Nadarajan"]
TEAMS = ["Kuantan Raiders FC", "Temerloh Hornets", "Bentong Highlanders", "Pekan Royals FC", "Raub Tigers",
         "Jerantut Rangers", "Lipis Warriors", "Rompin Mariners", "Maran Falcons", "Bera Lakers FC",
         "Cameron Pines FC", "Muadzam Stallions"]
B15_TEAMS = ["SK Demo Indera Mahkota", "SK Demo Beserah", "SK Demo Bukit Ubi", "SK Demo Tanjung Lumpur",
             "SK Demo Semambu", "SK Demo Balok", "SK Demo Gambang", "SK Demo Sungai Isap"]
VENUES = ["Stadium Darul Makmur, Kuantan", "Stadium Temerloh", "Padang Majlis Perbandaran Bentong",
          "Stadium Pekan", "Padang Bandar Raub", "Kompleks Sukan Jerantut"]
CUACA = ["Cerah", "Cerah", "Cerah", "Mendung", "Panas Terik", "Berangin"]
SHIRT = ["S", "M", "M", "L", "L", "XL", "XXL"]
WORK = ["Bekerja (Kerajaan)", "Bekerja (Swasta)", "Bekerja Sendiri", "Pelajar"]
WARIS = [("ISTERI", "Isteri"), ("BAPA", "Bapa"), ("IBU", "Ibu"), ("ABANG", "Abang")]
NASIHAT = ["Kekalkan prestasi.", "Perbaiki posisi semasa sepakan penjuru.",
           "Komunikasi dengan penolong pengadil perlu lebih kerap.",
           "Gunakan isyarat tangan yang lebih jelas.", "Jaga jarak dengan permainan supaya tidak mengganggu pemain."]
ULASAN = ["Kru pengadil mengawal perlawanan dengan baik dan tenang.",
          "Perlawanan berintensiti tinggi; keputusan utama tepat.",
          "Kerjasama kru baik. Beberapa keputusan ofsaid lewat diberi.",
          "Prestasi memuaskan secara keseluruhan."]


def hex_token(length: int = 32) -> str:
    return "".join(rng.choice("0123456789abcdef") for _ in range(length))


def bcrypt_hashes(passwords: list[str]) -> list[str]:
    """bcryptjs (cost 10), the same library the Worker verifies with."""
    script = ("const b=require('bcryptjs');let s='';process.stdin.on('data',d=>s+=d).on('end',()=>"
              "console.log(JSON.stringify(JSON.parse(s).map(p=>b.hashSync(p,10)))));")
    result = subprocess.run(["node", "-e", script], input=json.dumps(passwords), capture_output=True,
                            text=True, check=True, cwd=CLOUDFLARE)
    return json.loads(result.stdout)


def ts(day: date, hour: int = 9, minute: int = 0) -> str:
    return f"{day.isoformat()} {hour:02d}:{minute:02d}:00"


class Seed:
    def __init__(self, db: sqlite3.Connection, today: date):
        self.db = db
        self.today = today
        self.criteria = json.loads((CLOUDFLARE / "src" / "kriteria-penilaian.json").read_text())
        self.next_ic = 0
        self.slug_counts: dict[str, int] = {}
        self.users: dict[int, dict] = {}
        self.by_role: dict[str, list[int]] = {}
        self.luar: list[dict] = []
        self.districts = {row[0]: row[1] for row in db.execute("SELECT id,nama FROM districts")}

    def insert(self, table: str, row: dict) -> int:
        columns = ", ".join(f'"{key}"' for key in row)
        marks = ", ".join("?" for _ in row)
        return self.db.execute(f'INSERT INTO "{table}" ({columns}) VALUES ({marks})', list(row.values())).lastrowid

    # People -----------------------------------------------------------------
    def person_name(self, female: bool = False) -> str:
        if female:
            return f"{rng.choice(FEMALE)} binti {rng.choice(FATHER)}"
        roll = rng.random()
        if roll < 0.12:
            return f"{rng.choice(CHINESE)} {rng.choice(CHINESE_GIVEN)}"
        if roll < 0.2:
            return f"{rng.choice(INDIAN)} a/l {rng.choice(INDIAN_FATHER)}"
        given = " ".join(part for part in (rng.choice(MALE), rng.choice(SECOND)) if part)
        return f"{given} bin {rng.choice(FATHER)}"

    def fake_ic(self, female: bool) -> tuple[str, int]:
        self.next_ic += 1
        born = date(1975, 1, 1) + timedelta(days=rng.randrange(0, 29 * 365))
        last = (self.next_ic * 2 + (0 if female else 1)) % 10000
        age = self.today.year - born.year - ((self.today.month, self.today.day) < (born.month, born.day))
        return f"{born:%y%m%d}00{last:04d}", age

    def fake_phone(self) -> str:
        return f"0000{rng.randrange(0, 1_000_000):06d}"

    def demo_email(self, name: str) -> str:
        slug = "".join(ch for ch in name.lower().split(" bin")[0].split(" a/l")[0].split(" binti")[0]
                       .replace(" ", ".") if ch.isalnum() or ch == ".")
        self.slug_counts[slug] = self.slug_counts.get(slug, 0) + 1
        return f"{slug}.{self.slug_counts[slug]}@demo.invalid"

    def add_user(self, role: str, district: int, jenis: str | None, *, email: str | None = None,
                 password: str, name: str | None = None, female: bool = False, telegram: bool = True,
                 tahun_mula: int | None = None) -> int:
        name = name or self.person_name(female)
        ic, age = self.fake_ic(female)
        daerah = self.districts[district]
        waris = rng.choice(WARIS)
        row = {
            "email": email or self.demo_email(name), "password": password, "role": role,
            "district_id": district, "persatuan_id": district, "nama_penuh": name.upper(), "no_ic": ic,
            "no_telefon": self.fake_phone(), "telegram_chat_id": None,
            "alamat1": f"No. {rng.randrange(1, 200)}, Jalan Demo {rng.randrange(1, 30)}",
            "alamat2": f"Taman Latihan {daerah}", "poskod": f"2{rng.randrange(5000, 9999)}", "daerah": daerah,
            "negeri": "Pahang", "status_kerja": rng.choice(WORK), "jawatan": "Pegawai Demo",
            "nama_majikan": "Syarikat Demo Sdn Bhd", "nama_waris": self.person_name(waris[0] in ("ISTERI", "IBU")).upper(),
            "hubungan_waris": waris[1], "telefon_waris": self.fake_phone(),
            "jantina": "Perempuan" if female else "Lelaki", "jenis_pengadil": jenis,
            "tahun_mula_aktif": str(tahun_mula or rng.randrange(2008, 2024)), "saiz_baju": rng.choice(SHIRT),
            "aktif": 1, "password_changed": 1, "umur": age,
            "pengadil_negeri": 1 if jenis == "Pengadil Negeri" else 0,
            "pengadil_kebangsaan": 1 if jenis == "Pengadil Kebangsaan" else 0,
            "tahun_lulus_kelas3": "2026" if jenis == "Kelas III FAM" else None,
            "created_at": ts(date(2026, 1, 5)), "updated_at": ts(date(2026, 1, 5)),
        }
        user_id = self.insert("users", row)
        if telegram:
            row["telegram_chat_id"] = FAKE_CHAT_CEILING - user_id
            self.db.execute("UPDATE users SET telegram_chat_id=? WHERE id=?", (row["telegram_chat_id"], user_id))
        row["id"] = user_id
        self.users[user_id] = row
        self.by_role.setdefault(role, []).append(user_id)
        return user_id

    def add_luar(self, name: str, daerah: str, negeri: str, jenis: str) -> dict:
        row = {"nama": name.upper(), "daerah": daerah, "negeri": negeri, "no_tel": self.fake_phone(),
               "emel": self.demo_email(name), "jenis_pengadil": jenis,
               "created_at": ts(date(2026, 1, 5)), "updated_at": ts(date(2026, 1, 5))}
        row["id"] = self.insert("pengadil_luar", row)
        self.db.execute("UPDATE pengadil_luar SET telegram_chat_id=? WHERE id=?",
                        (FAKE_CHAT_CEILING - 500_000 - row["id"], row["id"]))
        self.luar.append(row)
        return row

    def application(self, user_id: int, year: int, borang: str, status: str, workflow: str, *,
                    submitted: date, pp: int | None = None, admin: int | None = None, notes: str | None = None) -> int:
        user = self.users[user_id]
        approved = status == "Approved"
        jenis_permohonan = {"pengadil_berdaftar": "pendaftaran_pengadil", "penilai_berdaftar": "pendaftaran_pengadil",
                            "kelas3_fam": "kelas3_fam"}[borang]
        return self.insert("permohonan", {
            "user_id": user_id, "district_id": user["district_id"], "persatuan_id": user["persatuan_id"],
            "tahun_permohonan": year, "jenis_permohonan": jenis_permohonan, "jenis_borang": borang,
            "nama_penuh": user["nama_penuh"], "no_kp": user["no_ic"], "emel": user["email"],
            "no_telefon": user["no_telefon"], "jantina": user["jantina"], "jenis_pengadil": user["jenis_pengadil"],
            "persatuan_daerah": f"Persatuan Bolasepak Daerah {user['daerah']}", "saiz_baju": user["saiz_baju"],
            "tahun_mula_aktif": user["tahun_mula_aktif"], "alamat1": user["alamat1"], "alamat2": user["alamat2"],
            "poskod": user["poskod"], "daerah": user["daerah"], "negeri": "Pahang", "status_kerja": user["status_kerja"],
            "jawatan": user["jawatan"], "nama_majikan": user["nama_majikan"], "nama_waris": user["nama_waris"],
            "hubungan_waris": user["hubungan_waris"], "telefon_waris": user["telefon_waris"],
            "status": status, "status_workflow": workflow,
            "workflow_status": "Approved" if borang == "kelas3_fam" and approved else None,
            "pp_verified_at": ts(submitted + timedelta(days=2)) if pp else None, "pp_verified_by": pp,
            "pp_notes": notes if pp and status == "Rejected" else ("Disahkan." if pp else None),
            "admin_approved_at": ts(submitted + timedelta(days=5)) if admin else None, "admin_approved_by": admin,
            "admin_notes": notes if admin and status == "Rejected" else None,
            "final_approved_at": ts(submitted + timedelta(days=5)) if approved else None,
            "payment_amount": "80.00", "tarikh_hantar": ts(submitted, 20), "umur": user["umur"],
            "declare1": 1, "declare2": 1, "declare3": 1, "declare4": 1, "declare5": 1,
            "updated_at": ts(submitted + timedelta(days=5 if admin else 2 if pp else 0), 20),
        })

    def people(self, accounts: list[dict], hashes: list[str], unusable: str) -> None:
        shared = {account["emel"]: hashes[index] for index, account in enumerate(accounts)}
        kuantan, temerloh, bentong = 5, 11, 1
        self.admin = self.add_user("Admin", kuantan, None, email="admin@demo.refpahang.com",
                                   password=shared["admin@demo.refpahang.com"], name="Pentadbir Demo RefPahang", telegram=True)
        self.pp_shared = self.add_user("PP Daerah", kuantan, "Pegawai Pembangunan", email="pp@demo.refpahang.com",
                                       password=shared["pp@demo.refpahang.com"])
        self.pp_ra = self.add_user("PP Daerah", temerloh, "Penilai Pengadil", email="pp-ra@demo.refpahang.com",
                                   password=shared["pp-ra@demo.refpahang.com"])
        self.pp_ref = self.add_user("PP Daerah", bentong, "Pengadil Negeri", email="pp-pengadil@demo.refpahang.com",
                                    password=shared["pp-pengadil@demo.refpahang.com"])
        self.ref_shared = self.add_user("Pengadil", kuantan, "Pengadil Negeri", email="pengadil@demo.refpahang.com",
                                        password=shared["pengadil@demo.refpahang.com"], tahun_mula=2015)
        self.ra_shared = self.add_user("Penilai", kuantan, "Penilai Pengadil", email="penilai@demo.refpahang.com",
                                       password=shared["penilai@demo.refpahang.com"])
        self.pp_by_district = {kuantan: self.pp_shared, temerloh: self.pp_ra, bentong: self.pp_ref}
        for district in self.districts:
            if district not in self.pp_by_district:
                self.pp_by_district[district] = self.add_user("PP Daerah", district, "Pegawai Pembangunan", password=unusable)
        jenis_pool = ["Pengadil Negeri"] * 50 + ["Pengadil Kebangsaan"] * 10 + ["Kelas III FAM"] * 12
        districts = list(self.districts)
        for index, jenis in enumerate(jenis_pool):
            # Kuantan carries the most referees, so the shared PP has a busy list.
            district = 5 if index % 4 == 0 else rng.choice(districts)
            self.add_user("Pengadil", district, jenis, password=unusable, female=index % 23 == 7,
                          telegram=index % 17 != 3)
        for _ in range(8):
            self.add_user("Penilai", rng.choice(districts), "Penilai Pengadil", password=unusable)
        for name, daerah, negeri, jenis in [
            ("Zainal Abidin bin Hamzah", "Kuala Terengganu", "Terengganu", "Pengadil Kebangsaan"),
            ("Lokman bin Haji Sapian", "Kota Bharu", "Kelantan", "Pengadil Negeri"),
            ("Wan Azhar bin Wan Ismail", "Kemaman", "Terengganu", "Pengadil Negeri"),
            ("Ramli bin Zakaria", "Segamat", "Johor", "Pengadil Negeri"),
            ("Hasnul bin Mat Isa", "Seremban", "Negeri Sembilan", "Penilai Pengadil"),
            ("Datuk Rosli bin Ahmad", "Kuantan", "Pahang", "Penilai Pengadil"),
            ("Shamsul Bahri bin Yaakob", "Temerloh", "Pahang", "Penilai Pengadil"),
        ]:
            self.add_luar(name, daerah, negeri, jenis)
        self.chairs = self.luar[-2:]

    def registrations(self) -> None:
        """Annual registration: what makes an official active for 2026 (appointment-eligibility.ts)."""
        for user_id, user in self.users.items():
            jenis = user["jenis_pengadil"]
            if user["role"] == "Admin" or jenis == "Pegawai Pembangunan":
                continue
            pp = self.pp_by_district[user["district_id"]]
            if jenis == "Penilai Pengadil":
                self.application(user_id, 2026, "penilai_berdaftar", "Approved", "Lengkap",
                                 submitted=date(2026, 1, 15), pp=pp if pp != user_id else None, admin=self.admin)
            elif jenis == "Kelas III FAM":
                self.application(user_id, 2026, "kelas3_fam", "Approved", "Lengkap",
                                 submitted=date(2026, 2, 10), admin=self.admin)
            else:
                if rng.random() < 0.7:
                    self.application(user_id, 2025, "pengadil_berdaftar", "Approved", "Lengkap",
                                     submitted=date(2025, 1, 20), pp=pp if pp != user_id else None, admin=self.admin)
                self.application(user_id, 2026, "pengadil_berdaftar", "Approved", "Lengkap",
                                 submitted=date(2026, 1, 12) + timedelta(days=rng.randrange(0, 40)),
                                 pp=pp if pp != user_id else None, admin=self.admin)
        # 2027 window: work waiting for the PP and the Admin, and one rejection.
        referees = [uid for uid in self.by_role["Pengadil"]
                    if uid != self.ref_shared and self.users[uid]["jenis_pengadil"] != "Kelas III FAM"]
        kuantan = [uid for uid in referees if self.users[uid]["district_id"] == 5]
        others = [uid for uid in referees if self.users[uid]["district_id"] not in (5,)]
        for uid in kuantan[:4]:
            self.application(uid, 2027, "pengadil_berdaftar", "Pending", "Menunggu PP Daerah",
                             submitted=self.today - timedelta(days=rng.randrange(1, 6)))
        for uid in [u for u in others if self.users[u]["district_id"] in (11, 1)][:4]:
            self.application(uid, 2027, "pengadil_berdaftar", "Pending", "Menunggu PP Daerah",
                             submitted=self.today - timedelta(days=rng.randrange(1, 6)))
        for uid in kuantan[4:6] + others[6:8]:
            self.application(uid, 2027, "pengadil_berdaftar", "Pending", "Menunggu Admin",
                             submitted=self.today - timedelta(days=8), pp=self.pp_by_district[self.users[uid]["district_id"]])
        rejected = others[8]
        self.application(rejected, 2027, "pengadil_berdaftar", "Rejected", "Ditolak",
                         submitted=self.today - timedelta(days=12), pp=self.pp_by_district[self.users[rejected]["district_id"]],
                         notes="Resit bayaran tidak jelas. Sila hantar semula.")

    def match_history(self) -> None:
        """Self-reported match records (perlawanan) that registration requires (min_verified_matches)."""
        jenis = ["Persahabatan", "Liga", "Piala", "MSS Daerah", "Persahabatan"]
        roles = ["Pengadil", "Penolong Pengadil 1", "Penolong Pengadil 2"]
        officials = [uid for uid, user in self.users.items()
                     if user["role"] in ("Pengadil",) or uid == self.pp_ref]
        for uid in officials:
            user = self.users[uid]
            count = 26 if uid == self.ref_shared else rng.randrange(8, 30)
            days = sorted(rng.sample(range(0, 640), count))
            pending = 3 if user["district_id"] == 5 and uid != self.ref_shared else (2 if uid == self.ref_shared else 0)
            for index, offset in enumerate(days):
                day = date(2025, 1, 4) + timedelta(days=offset)
                if day >= self.today:
                    day = self.today - timedelta(days=index + 1)
                home, away = rng.sample(TEAMS, 2)
                verified = index < count - pending
                self.insert("perlawanan", {
                    "match_group_id": hex_token(16), "user_id": uid, "submitted_by": uid,
                    "status_pp": "Disahkan" if verified else "Belum Disahkan",
                    "verified_by": self.pp_by_district[user["district_id"]] if verified else None,
                    "verified_at": ts(day + timedelta(days=3)) if verified else None,
                    "district_id": user["district_id"], "persatuan_id": user["persatuan_id"],
                    "daerah_perlawanan_id": user["district_id"], "tarikh": day.isoformat(), "masa": "16:30:00",
                    "jenis": rng.choice(jenis), "nama_kejohanan": f"Perlawanan {rng.choice(jenis)} Demo {day.year}",
                    "tempat": rng.choice(VENUES), "home_team": home, "away_team": away,
                    "skor_ft_home": rng.randrange(0, 4), "skor_ft_away": rng.randrange(0, 4),
                    "jawatan": rng.choice(roles), "created_at": ts(day + timedelta(days=1), 21),
                })

    # Tournaments --------------------------------------------------------------
    def tournament(self, nama: str, jenis: str, peringkat: str, start: date, end: date, status: str, tempat: str) -> int:
        return self.insert("kejohanan", {
            "nama": nama, "jenis_kejohanan": jenis, "peringkat_kejohanan": peringkat,
            "tarikh_mula": start.isoformat(), "tarikh_akhir": end.isoformat(), "tempat": tempat,
            "anjuran": "Persatuan Bola Sepak Negeri Pahang (Demo)", "status": status, "created_by": self.admin,
            "created_at": ts(start - timedelta(days=30)), "updated_at": ts(start - timedelta(days=30)),
        })

    def pick_crew(self, used: set[int]) -> dict[str, int]:
        referees = [uid for uid in self.by_role["Pengadil"] if uid not in used
                    and self.users[uid]["telegram_chat_id"] is not None]
        chosen = rng.sample(referees, 4)
        return dict(zip(KUP, chosen))

    def appoint(self, jadual: int, jawatan: str, *, pengadil: int | None = None, luar: int | None = None,
                status: str, notified: date, answered: date | None = None, komen: str | None = None) -> int:
        lantikan = self.insert("lantikan_pengadil", {
            "jadual_id": jadual, "pengadil_id": pengadil, "pengadil_luar_id": luar, "jawatan": jawatan,
            "status": status, "komen": komen, "tarikh_jawab": ts(answered, 21) if answered else None,
            "notif_hantar": 1, "tg_token": hex_token(), "email_token": hex_token(),
            "penilaian_token": hex_token(64) if jawatan == "Penilai Pengadil" else None, "tg_notif_hantar": 1,
            "tarikh_notif": ts(notified, 8), "created_by": self.admin,
            "created_at": ts(notified, 8), "updated_at": ts(answered or notified, 21),
        })
        return lantikan

    def match(self, kejohanan: int, number: int, day: date, masa: str, home: str, away: str, tempat: str,
              status: str, kategori: str, peringkat: str) -> int:
        return self.insert("jadual_perlawanan", {
            "kejohanan_id": kejohanan, "no_perlawanan": f"{number:02d}", "tarikh": day.isoformat(), "masa": masa,
            "hari": HARI[day.weekday()], "kategori": kategori, "peringkat": peringkat, "kumpulan": "",
            "pasukan_home": home, "pasukan_away": away, "tempat": tempat, "status": status,
            "created_at": ts(day - timedelta(days=21)), "updated_at": ts(day - timedelta(days=21)),
        })

    def history_rows(self, jadual: int) -> None:
        """historySyncStatements(): accepted registered KUP crew get a verified match record."""
        crew = {row[0]: row[1] for row in self.db.execute(
            "SELECT jawatan,pengadil_id FROM lantikan_pengadil WHERE jadual_id=? AND status='Diterima'", (jadual,))}
        match = self.db.execute("""SELECT jp.tarikh,jp.masa,jp.kategori,jp.peringkat,kj.nama,jp.tempat,
            jp.pasukan_home,jp.pasukan_away FROM jadual_perlawanan jp JOIN kejohanan kj ON kj.id=jp.kejohanan_id
            WHERE jp.id=?""", (jadual,)).fetchone()
        jenis = (" - ".join(part for part in (match[4], match[2], match[3]) if part))[:60]
        for lantikan, jawatan, pengadil in self.db.execute("""SELECT id,jawatan,pengadil_id FROM lantikan_pengadil
                WHERE jadual_id=? AND status='Diterima' AND pengadil_id IS NOT NULL AND jawatan IN
                ('Pengadil','Penolong Pengadil 1','Penolong Pengadil 2','Pegawai ke4')""", (jadual,)).fetchall():
            self.insert("perlawanan", {
                "user_id": pengadil, "lantikan_id": lantikan, "tarikh": match[0], "masa": match[1], "jenis": jenis,
                "nama_kejohanan": match[4], "tempat": match[5], "home_team": match[6], "away_team": match[7],
                "jawatan": jawatan, "head_referee_id": crew.get("Pengadil"),
                "assistant_referee_1_id": crew.get("Penolong Pengadil 1"),
                "assistant_referee_2_id": crew.get("Penolong Pengadil 2"),
                "fourth_official_id": crew.get("Pegawai ke4"), "status_pp": "Disahkan",
                "created_at": ts(date.fromisoformat(match[0]) - timedelta(days=5), 21),
            })

    def report(self, jadual: int, ra_lantikan: int, ra_user: int, day: date, chair_link: int, chair: dict,
               status: str) -> None:
        home, away = rng.randrange(0, 4), rng.randrange(0, 4)
        sent = day + timedelta(days=1)
        laporan = self.insert("laporan_penilaian", {
            "jadual_id": jadual, "lantikan_id": ra_lantikan, "penilai_id": ra_user,
            "tahap_kesukaran": "Susah" if rng.random() < 0.1 else "Normal",
            "skor_ht_home": min(home, rng.randrange(0, 3)), "skor_ht_away": min(away, rng.randrange(0, 3)),
            "skor_ft_home": home, "skor_ft_away": away, "cuaca": rng.choice(CUACA),
            "ulasan_keseluruhan": rng.choice(ULASAN), "status": status, "tarikh_hantar": ts(sent, 22),
            "tarikh_sahkan": ts(sent + timedelta(days=1), 10) if status == "Disahkan" else None,
            "created_at": ts(day, 22), "updated_at": ts(sent, 22),
        })
        for lantikan, jawatan, nama in self.db.execute("""SELECT lp.id,lp.jawatan,COALESCE(u.nama_penuh,pl.nama)
                FROM lantikan_pengadil lp LEFT JOIN users u ON u.id=lp.pengadil_id
                LEFT JOIN pengadil_luar pl ON pl.id=lp.pengadil_luar_id
                WHERE lp.jadual_id=? AND lp.status='Diterima' AND lp.jawatan IN
                ('Pengadil','Penolong Pengadil 1','Penolong Pengadil 2','Pegawai ke4') ORDER BY lp.id""", (jadual,)).fetchall():
            group = self.criteria["Penolong Pengadil" if jawatan.startswith("Penolong") else jawatan]
            sections = list(group.values())
            markah = round(rng.uniform(7.6, 8.8), 1)
            prestasi = "Sangat Baik" if markah >= 8.5 else "Baik" if markah >= 8.0 else "Memuaskan"
            row = {"laporan_id": laporan, "lantikan_pengadil_id": lantikan, "jawatan": jawatan, "nama_pengadil": nama,
                   "markah": f"{markah:.1f}", "prestasi": prestasi}
            for column, section in zip(["kawalan", "fizikal", "kerjasama"], sections + [sections[0]] * 3):
                items = section["items"]
                row[f"{column}_kekuatan"] = json.dumps(rng.sample(items, min(len(items), rng.randrange(2, 5))), ensure_ascii=False)
                row[f"{column}_kelemahan"] = json.dumps(rng.sample(items, 1) if rng.random() < 0.4 else [], ensure_ascii=False)
                row[f"{column}_nasihat"] = rng.choice(NASIHAT)
            self.insert("laporan_penilaian_pegawai", row)
        self.insert("laporan_pengesahan_pengerusi", {
            "laporan_id": laporan, "kejohanan_pengesah_id": chair_link, "pengesah_luar_id": chair["id"],
            "pengesah_nama": chair["nama"], "pengesah_jawatan": "Pengerusi Pengadil", "pengesah_negeri": chair["negeri"],
            "approval_token": hex_token(64), "status": "Disahkan" if status == "Disahkan" else "Menunggu",
            "email_recipient": chair["emel"], "email_sent_at": ts(sent, 22), "email_attempts": 1,
            "telegram_chat_id": FAKE_CHAT_CEILING - 500_000 - chair["id"], "telegram_sent_at": ts(sent, 22),
            "telegram_attempts": 1, "admin_copy_at": ts(sent, 22),
            "tarikh_sahkan": ts(sent + timedelta(days=1), 10) if status == "Disahkan" else None,
            "catatan_pengerusi": "Disahkan." if status == "Disahkan" else None,
            "created_at": ts(sent, 22), "updated_at": ts(sent + timedelta(days=1), 10),
        })

    def tournaments(self) -> None:
        today = self.today
        # Weekly league around today: finished weeks behind, open weeks ahead.
        first = today - timedelta(days=(today.weekday() - 5) % 7) - timedelta(weeks=7)
        liga = self.tournament("LIGA DEMO PAHANG 2026", "Liga", "Negeri", first, first + timedelta(weeks=14),
                               "Aktif", "Seluruh Pahang")
        karnival_day = today - timedelta(days=70)
        karnival = self.tournament("KARNIVAL BOLA SEPAK DEMO B15 DAERAH KUANTAN 2026", "Karnival", "Daerah",
                                   karnival_day, karnival_day + timedelta(days=1), "Selesai", "Stadium Darul Makmur, Kuantan")
        piala_day = today + timedelta(days=28)
        piala = self.tournament("PIALA DEMO PAHANG 2026", "Piala", "Negeri", piala_day, piala_day + timedelta(days=8),
                                "Aktif", "Stadium Temerloh")
        links = {}
        for kejohanan, chair in [(liga, self.chairs[0]), (karnival, self.chairs[1]), (piala, self.chairs[0])]:
            links[kejohanan] = self.insert("kejohanan_pengesah_laporan", {
                "kejohanan_id": kejohanan, "pengesah_luar_id": chair["id"], "nama_snapshot": chair["nama"],
                "jawatan_snapshot": "Pengerusi Pengadil", "peringkat_snapshot": "Negeri", "aktif": 1,
                "created_by": self.admin})
        for kejohanan in (liga, karnival):
            self.insert("jadual_lantikan_pengesahan", {
                "kejohanan_id": kejohanan, "nama_penyahkan": "SETIAUSAHA JAWATANKUASA PENGADIL (DEMO)",
                "jawatan_penyahkan": "Setiausaha Jawatankuasa Pengadil", "nota": "Jadual lantikan disahkan.",
                "created_by": self.admin})
        assessors = [uid for uid in self.by_role["Penilai"] if uid != self.ra_shared]
        chair_of = {liga: self.chairs[0], karnival: self.chairs[1], piala: self.chairs[0]}
        pools: dict[int, set] = {liga: set(), karnival: set(), piala: set()}

        def staffed(kejohanan: int, jadual: int, day: date, *, ra: int | None, state: str,
                    crew: dict[str, int] | None = None, pending: dict[str, int] | None = None) -> None:
            """state: selesai | menunggu_laporan | menunggu_pengerusi | disahkan | menunggu_jawapan."""
            crew = crew or self.pick_crew(set())
            notified = day - timedelta(days=10) if state != "menunggu_jawapan" else today
            ids = {}
            for jawatan, uid in crew.items():
                waiting = state == "menunggu_jawapan" and pending and jawatan in pending
                ids[jawatan] = self.appoint(jadual, jawatan, pengadil=uid, status="Belum Jawab" if waiting else "Diterima",
                                            notified=notified, answered=None if waiting else notified + timedelta(days=1))
                pools[kejohanan].add(uid)
            if ra:
                ra_waiting = state == "menunggu_jawapan" and pending and "Penilai Pengadil" in pending
                ids["ra"] = self.appoint(jadual, "Penilai Pengadil", pengadil=ra, notified=notified,
                                         status="Belum Jawab" if ra_waiting else "Diterima",
                                         answered=None if ra_waiting else notified + timedelta(days=1))
                pools[kejohanan].add(ra)
            if state in ("selesai", "menunggu_laporan", "menunggu_pengerusi", "disahkan"):
                self.history_rows(jadual)
            if state == "selesai":
                self.report(jadual, ids["ra"], ra, day, links[kejohanan], chair_of[kejohanan], "Disahkan")
            if state == "menunggu_pengerusi":
                self.report(jadual, ids["ra"], ra, day, links[kejohanan], chair_of[kejohanan], "Dihantar")

        number = 0
        for week in range(15):
            for slot, masa in enumerate(["16:00:00", "20:45:00"]):
                day = first + timedelta(weeks=week)
                number += 1
                home, away = TEAMS[(week + slot * 5) % 12], TEAMS[(week * 3 + slot * 7 + 1) % 12]
                if home == away:
                    away = TEAMS[(TEAMS.index(home) + 6) % 12]
                tempat = VENUES[(week + slot) % len(VENUES)]
                if day == today:
                    day -= timedelta(days=1)  # played last night, so its state is unambiguous
                days_ago = (today - day).days
                if days_ago > 10:
                    jadual = self.match(liga, number, day, masa, home, away, tempat, "Selesai", "TERBUKA", "Liga")
                    staffed(liga, jadual, day, ra=rng.choice(assessors), state="selesai")
                elif days_ago > 0:
                    # Last weekend: one report for the shared RA to write, one with the chair, one for the PP-RA.
                    if slot == 0:
                        jadual = self.match(liga, number, day, masa, home, away, tempat, "Disahkan", "TERBUKA", "Liga")
                        crew = self.pick_crew({self.ref_shared})
                        crew["Pengadil"] = self.ref_shared
                        staffed(liga, jadual, day, ra=self.ra_shared, state="menunggu_laporan", crew=crew)
                    else:
                        jadual = self.match(liga, number, day, masa, home, away, tempat, "Disahkan", "TERBUKA", "Liga")
                        staffed(liga, jadual, day, ra=self.pp_ra, state="menunggu_laporan")
                elif days_ago >= -7:
                    jadual = self.match(liga, number, day, masa, home, away, tempat, "Menunggu Pengesahan", "TERBUKA", "Liga")
                    crew = self.pick_crew({self.ref_shared, self.pp_ref})
                    if slot == 0:
                        crew["Pengadil"] = self.ref_shared
                        staffed(liga, jadual, day, ra=rng.choice(assessors), state="menunggu_jawapan", crew=crew,
                                pending={"Pengadil": 1, "Penolong Pengadil 2": 1})
                    else:
                        crew["Penolong Pengadil 1"] = self.pp_ref
                        staffed(liga, jadual, day, ra=self.ra_shared, state="menunggu_jawapan", crew=crew,
                                pending={"Penolong Pengadil 1": 1, "Penilai Pengadil": 1})
                elif days_ago >= -14:
                    jadual = self.match(liga, number, day, masa, home, away, tempat, "Disahkan", "TERBUKA", "Liga")
                    crew = self.pick_crew({self.ref_shared})
                    if slot == 1:
                        crew["Penolong Pengadil 2"] = self.ref_shared
                    staffed(liga, jadual, day, ra=rng.choice(assessors), state="disahkan", crew=crew)
                elif week == 12 and slot == 1:
                    jadual = self.match(liga, number, day, masa, home, away, tempat, "Dibatalkan", "TERBUKA", "Liga")
                    self.db.execute("UPDATE jadual_perlawanan SET sebab_status=?,status_dikemaskini_at=? WHERE id=?",
                                    ("Padang dinaik taraf.", ts(today - timedelta(days=3)), jadual))
                else:
                    self.match(liga, number, day, masa, home, away, tempat, "Belum Lantik", "TERBUKA", "Liga")
        # One report already with the chair (pengesahan Menunggu).
        older = self.db.execute("""SELECT jp.id,jp.tarikh FROM jadual_perlawanan jp WHERE jp.kejohanan_id=? AND
            jp.status='Selesai' ORDER BY jp.tarikh DESC LIMIT 1""", (liga,)).fetchone()
        if older:
            self.db.execute("DELETE FROM laporan_pengesahan_pengerusi WHERE laporan_id IN (SELECT id FROM laporan_penilaian WHERE jadual_id=?)", (older[0],))
            self.db.execute("DELETE FROM laporan_penilaian_pegawai WHERE laporan_id IN (SELECT id FROM laporan_penilaian WHERE jadual_id=?)", (older[0],))
            self.db.execute("DELETE FROM laporan_penilaian WHERE jadual_id=?", (older[0],))
            self.db.execute("UPDATE jadual_perlawanan SET status='Disahkan' WHERE id=?", (older[0],))
            ra_row = self.db.execute("SELECT id,pengadil_id FROM lantikan_pengadil WHERE jadual_id=? AND jawatan='Penilai Pengadil'",
                                     (older[0],)).fetchone()
            self.report(older[0], ra_row[0], ra_row[1], date.fromisoformat(older[1]), links[liga], chair_of[liga], "Dihantar")

        # Finished district carnival, including officials from outside Pahang.
        for index in range(8):
            day = karnival_day + timedelta(days=index // 4)
            home, away = B15_TEAMS[(index * 2) % 8], B15_TEAMS[(index * 2 + 1 + index // 4) % 8]
            jadual = self.match(karnival, index + 1, day, ["08:00:00", "09:30:00", "11:00:00", "16:00:00"][index % 4],
                                home, away, "Stadium Darul Makmur, Kuantan", "Selesai", "B15",
                                "Kumpulan" if index < 6 else ("Separuh Akhir" if index == 6 else "Final"))
            crew = self.pick_crew(set())
            del crew["Pegawai ke4"]
            staffed(karnival, jadual, day, ra=rng.choice(assessors), state="selesai", crew=crew)
            if index in (2, 5):
                outsider = self.luar[index // 3]
                self.db.execute("""UPDATE lantikan_pengadil SET pengadil_id=NULL,pengadil_luar_id=? WHERE jadual_id=?
                    AND jawatan='Penolong Pengadil 2'""", (outsider["id"], jadual))
                self.db.execute("""DELETE FROM perlawanan WHERE lantikan_id IN (SELECT id FROM lantikan_pengadil
                    WHERE jadual_id=? AND jawatan='Penolong Pengadil 2')""", (jadual,))
                self.db.execute("""UPDATE laporan_penilaian_pegawai SET nama_pengadil=? WHERE jawatan='Penolong Pengadil 2'
                    AND laporan_id IN (SELECT id FROM laporan_penilaian WHERE jadual_id=?)""", (outsider["nama"], jadual))
                pools[karnival].add(("luar", outsider["id"]))

        # Upcoming cup: nothing appointed yet, a ready pool for the Admin to use.
        for index in range(8):
            day = piala_day + timedelta(days=(index // 2) * 2)
            home, away = TEAMS[index], TEAMS[(index + 4) % 12]
            self.match(piala, index + 1, day, ["16:00:00", "20:45:00"][index % 2], home, away, "Stadium Temerloh",
                       "Belum Lantik", "TERBUKA", "Suku Akhir" if index < 4 else ("Separuh Akhir" if index < 6 else "Final"))
        cup_pool = rng.sample([uid for uid in self.by_role["Pengadil"] if self.users[uid]["telegram_chat_id"] is not None], 24)
        pools[piala].update(cup_pool + [self.ref_shared, self.pp_ref, self.ra_shared, self.pp_ra] + assessors[:3])
        pools[liga].update([self.ref_shared, self.pp_ref, self.ra_shared, self.pp_ra])
        for kejohanan, members in pools.items():
            for member in members:
                if isinstance(member, tuple):
                    self.insert("pool_pengadil", {"kejohanan_id": kejohanan, "pengadil_luar_id": member[1]})
                else:
                    self.insert("pool_pengadil", {"kejohanan_id": kejohanan, "pengadil_id": member})

    def extras(self) -> None:
        for days_ago, title, content in [
            (20, "Selamat datang ke Sistem Demo RefPahang",
             "<p>Ini sistem latihan. Semua nama, perlawanan dan rekod adalah rekaan. Cuba apa sahaja fungsi tanpa risau.</p>"),
            (9, "Seminar Pengadil Demo 2027",
             "<p>Seminar tahunan pengadil akan diadakan di Kuantan. Pendaftaran 2027 kini dibuka.</p>"),
            (2, "Peringatan: Jawab lantikan dalam 48 jam",
             "<p>Lantikan yang tidak dijawab dalam tempoh 48 jam selepas notifikasi akan ditolak secara automatik.</p>"),
        ]:
            day = self.today - timedelta(days=days_ago)
            self.insert("announcements", {"title": title, "content": content, "created_by": self.admin,
                                          "created_at": ts(day, 10), "updated_at": ts(day, 10)})
        for user_id, subject, message in [
            (self.ref_shared, "Lantikan Baru", "Anda telah dilantik sebagai Pengadil. Sila jawab lantikan dalam 48 jam."),
            (self.ra_shared, "Laporan Penilaian Belum Dihantar", "Sila lengkapkan laporan penilaian untuk perlawanan minggu lepas."),
            (self.pp_shared, "Permohonan Baharu", "Terdapat permohonan pendaftaran 2027 menunggu semakan anda."),
            (self.admin, "Permohonan Menunggu Kelulusan", "Terdapat permohonan pendaftaran 2027 menunggu keputusan Admin."),
        ]:
            self.insert("notifications", {"user_id": user_id, "type": "Sistem", "subject": subject, "message": message,
                                          "is_read": 0, "created_at": ts(self.today, 8)})


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--schema-from", type=Path, required=True, help="private snapshot (schema only is read)")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--today", type=date.fromisoformat,
                        default=(datetime.utcnow() + timedelta(hours=8)).date())
    args = parser.parse_args()
    if args.output.exists():
        parser.error("Output already exists; use a new path")
    accounts = json.loads((HERE / "accounts.json").read_text())
    hashes = bcrypt_hashes([account["kata_laluan"] for account in accounts] + [hashlib.sha256(rng.randbytes(32)).hexdigest()])

    source = sqlite3.connect(f"file:{args.schema_from}?mode=ro", uri=True)
    db = sqlite3.connect(args.output)
    for kind in ("table", "index"):
        for (sql,) in source.execute("SELECT sql FROM sqlite_master WHERE type=? AND sql IS NOT NULL "
                                     "AND name NOT LIKE 'sqlite_%' ORDER BY name", (kind,)):
            db.execute(sql)
    for table in REFERENCE_TABLES:
        columns = [row[1] for row in source.execute(f'PRAGMA table_info("{table}")')]
        rows = source.execute(f'SELECT * FROM "{table}"').fetchall()
        db.executemany(f'INSERT INTO "{table}" VALUES ({", ".join("?" for _ in columns)})', rows)
    source.close()
    settings = {
        "maintenance_mode": "0", "applications_open": "1", "registration_open": "1", "berdaftar_open": "1",
        "penilai_open": "1", "application_year": "2027",
        "registration_open_date": (args.today - timedelta(days=30)).isoformat(),
        "registration_close_date": (args.today + timedelta(days=120)).isoformat(),
        "berdaftar_open_date": (args.today - timedelta(days=30)).isoformat(),
        "berdaftar_close_date": (args.today + timedelta(days=120)).isoformat(),
        "penilai_open_date": (args.today - timedelta(days=30)).isoformat(),
        "penilai_close_date": (args.today + timedelta(days=120)).isoformat(),
    }
    for key in ("payment_bank_name", "fam_bank_name", "registration_bank_name"):
        settings[key] = "Bank Demo Berhad"
    for key in ("payment_account_name", "registration_account_name"):
        settings[key] = "PERSATUAN BOLA SEPAK NEGERI PAHANG (AKAUN DEMO)"
    for key in ("payment_account_no", "fam_account_no", "registration_account_no"):
        settings[key] = "0000000000"
    for key, value in settings.items():
        db.execute("UPDATE application_settings SET setting_value=? WHERE setting_key=?", (value, key))

    seed = Seed(db, args.today)
    seed.people(accounts, hashes[:-1], hashes[-1])
    seed.registrations()
    seed.match_history()
    seed.tournaments()
    seed.extras()
    db.commit()
    problems = db.execute("PRAGMA foreign_key_check").fetchall()
    if problems:
        raise SystemExit(f"Foreign key problems: {problems[:5]}")
    counts = {table: db.execute(f'SELECT count(*) FROM "{table}"').fetchone()[0]
              for table in ("users", "pengadil_luar", "permohonan", "kejohanan", "jadual_perlawanan",
                            "lantikan_pengadil", "laporan_penilaian", "perlawanan", "pool_pengadil")}
    db.close()
    print(json.dumps({"output": str(args.output), "today": args.today.isoformat(), **counts}, indent=1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
