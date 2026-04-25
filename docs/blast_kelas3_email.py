#!/usr/bin/env python3
"""
Blast emel kelayakan Kelas III FAM 2026
Hantar credential (emel + kata laluan) kepada 42 pemohon.
"""

import smtplib
import ssl
import time
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

# SMTP Config
SMTP_HOST = "mail.refpahang.com"
SMTP_PORT = 465
SMTP_USER = "daftar@refpahang.com"
SMTP_PASS = "M@$uk0184714176"
FROM_NAME = "Pendaftaran Pengadil Pahang"
LOGIN_URL = "https://refpahang.com/login"

# 42 Pemohon Kelas III FAM 2026
PEMOHON = [
    ("MUHAMMAD AHZA BIN AZLAN", "ahzaazlan2003@gmail.com", "D4FabcazQe"),
    ("ROSDI BIN ABDULLAH", "rosdi5225@gmail.com", "dtEFPxpzGS"),
    ("MOHD FAISAL KAMIL BIN MOHD ADNAN", "abdullahayue01@gmail.com", "tXGgKBTn9T"),
    ("MOHAMAD NAZMI FIRDAUS BIN HASSAN", "mnazmifirdaus@gmail.com", "fpkNrnpwLm"),
    ("NUR HAFIZAN BIN MOHAMMAD NOR", "pijang95@gmail.com", "WQubeGdVMG"),
    ("MOHAMAD FAIZ BIN MAT RIFIN", "fareast18393@gmail.com", "QtA4ugzwYk"),
    ("MUHAMMAD ALIFF IKRAM BIN MUHAMAD", "aliffikram26@gmail.com", "jCfYF8BJvr"),
    ("AMIR ASRAF BIN MAZUKI", "amir.acap.93@gmail.com", "3RLQReW4kz"),
    ("MUHAMMAD AKMAL BIN ZAILAN", "akmalzailan151@gmail.com", "6m74aVyfws"),
    ("NOR HAFIZ AKMAL BIN RAZAK", "hafiz5855@gmail.com", "K7JaqWNdUq"),
    ("MOHD AMIRUL ADLI BIN AHMAD ZAKI", "amiruladli29@gmail.com", "QGbbCAQvBN"),
    ("ALIFF HARIZ BIN AMRAN", "entahlarh954@gmail.com", "GSzRzf6S4K"),
    ("MOHD AZIZI BIN KAMARUDIN", "haidilarezz@gmail.com", "c5KeqFsK9x"),
    ("RIDUAN BIN AWANG", "riduankatak123@gmail.com", "k8c7BNP9SL"),
    ("MUHAMMAD ADLI B. SAMSUDIN", "adli.samsudin06@gmail.com", "PKucYNUMGy"),
    ("MUHAMMAD RAZARIZAL BIN MOHAMMAD SAFIAN", "razarizalsafian97@gmail.com", "JyYsSbFbAK"),
    ("TI BIN YOK TAK", "tibinyoktak@gmail.com", "CySNEq9SnX"),
    ("SYED ABDUL YUSUF BIN SYED JALILUDDIN", "izzatiezamzuri2@gmail.com", "ZWpPxmtPVM"),
    ("MUHAMMAD HAFIZI BIN MOHD SALLEH", "hafiziesalleh98@gmail.com", "2Yxps9UvHa"),
    ("AHMAD IQBAL RIEZKY BIN AHMAD NOR SHAHID", "iriezky602@gmail.com", "dRuBZ9mvP8"),
    ("MUHAMMAD KHAIRUL ANWAR BIN RAZALI", "kayrulvienna46@gmail.com", "RC5xMJQWqF"),
    ("NIK MUHAMMAD MUNIR BIN NIK LAH", "nikmunir4520@gmail.com", "zDHx4FJdYK"),
    ("MUHAMMAD IZZUL ISLAM BIN MUHAMMAD NOOR", "izl.islam0305@gmail.com", "b9KWDA55VR"),
    ("MUHAMMAD IMAN AFIF BIN MOHD KAMIL", "imanafif2002@gmail.com", "XzzsZh4GR6"),
    ("ANWARI IKHLAS BIN BAHARUM", "ikhguero10@gmail.com", "6f5tNMeDcT"),
    ("ZAFFRAN NURIMAN BIN ABDULLAH", "mommynuriman86@gmail.com", "wTmbUQvyuc"),
    ("AHMAD HAZREEF IZZUDIN BIN AHMAD TAZUDIN", "hadeenafarisya@gmail.com", "cAZe8WJMMq"),
    ("ALEX BIN JUNE", "alexjune7196@gmail.com", "FZx43zhwUK"),
    ("MUHAMMAD SYAZWAN BIN NAZRI", "jjq2745@gmail.com", "sdPw7cYKjy"),
    ("MUHAMMAD HAFIZULLAH BIN SU'AIMI", "muhammadhafizullah323@gmail.com", "8uAKdAFLzD"),
    ("MUHAMMAD AMAR SHAUQI BIN NIRRAHIM", "amarkuki03@gmail.com", "V6TcGjPTHp"),
    ("ZULKIFLI BIN ALIAS", "zulkiflialias6339@gmail.com", "pjvNR64JXH"),
    ("MOHAMAD AMIRUL DARWISY BIN ROSLI", "cikaa74@gmail.com", "zV7DCr7KQp"),
    ("AHMAD FIRDAUS BIN AHMAD RADZI", "firdausradzi147@gmail.com", "3B9daK5QkJ"),
    ("MUHAMMAD ILHAN RAZIQ", "nazruldell82@gmail.com", "GKD5qKbjnZ"),
    ("MOHD BASAR BIN SERTI", "mohdbasar.serti@gmail.com", "KTpQ4neNT2"),
    ("MUHAMAD HAMIMUDDIN BIN ISMAIL", "hamimuddin92@gmail.com", "ZBCCEpahdk"),
    ("MUHAMMAD AZAM BIN ISMAIL", "azimijimmy0585@gmail.com", "BRLrVU9fz8"),
    ("AFIQ IKHWAN BIN AMRAN", "amranpolisas@gmail.com", "6WP2k5YyeJ"),
    ("AHMAD KHAIROL BIN KELANA", "fakhruliqbalrefkel@gmail.com", "r9mhZgQWT3"),
    ("MUHAMAD AZHARI BIN ANISUTISNA", "aidil179082@gmail.com", "U9xxdTUcgm"),
    ("MUHAMMAD TOHIR BIN KHAIRUDDIN", "muhdtohir1992@gmail.com", "g6kJtajjDL"),
]


def build_email(nama: str, emel: str, password: str) -> str:
    nama_title = nama.title()
    return f"""<!DOCTYPE html>
<html lang="ms">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:40px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

      <!-- Header -->
      <tr><td style="background:#1e3a8a;padding:32px 40px;text-align:center;">
        <p style="margin:0;font-size:28px;">🎉</p>
        <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:700;">Akaun Berjaya Didaftarkan</h1>
        <p style="margin:4px 0 0;color:#93c5fd;font-size:13px;">Sistem Pengurusan Pengadil — Persatuan Bola Sepak Negeri Pahang</p>
      </td></tr>

      <!-- Body -->
      <tr><td style="padding:36px 40px;">
        <p style="margin:0 0 16px;color:#374151;font-size:15px;">Assalamualaikum dan Salam Sejahtera,</p>
        <p style="margin:0 0 16px;color:#374151;font-size:15px;">Kepada <strong>{nama_title}</strong>,</p>
        <p style="margin:0 0 24px;color:#374151;font-size:15px;">
          Akaun anda dalam <strong>Sistem Pengurusan Pengadil Persatuan Bola Sepak Negeri Pahang</strong>
          telah didaftarkan untuk <strong>Peperiksaan Kelas III FAM 2026</strong>.
        </p>

        <!-- Credentials Box -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
          <tr><td style="padding:20px 24px;background:#eff6ff;border-radius:8px;border-left:4px solid #1e3a8a;">
            <p style="margin:0 0 6px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Alamat Emel (untuk log masuk)</p>
            <p style="margin:0 0 18px;font-size:15px;font-weight:700;color:#111827;font-family:monospace;">{emel}</p>
            <p style="margin:0 0 6px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Kata Laluan Sementara</p>
            <p style="margin:0;font-size:24px;font-weight:700;color:#1e3a8a;font-family:monospace;letter-spacing:4px;">{password}</p>
          </td></tr>
        </table>

        <!-- Warning -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
          <tr><td style="padding:16px 20px;background:#fffbeb;border-radius:8px;border-left:4px solid #f59e0b;">
            <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#92400e;">⏳ Keputusan Ujian Masih Dalam Proses</p>
            <p style="margin:0;font-size:13px;color:#78350f;">
              Permohonan anda sedang dalam semakan admin. Keputusan peperiksaan akan dikemas kini
              dalam sistem setelah diumumkan. Anda akan dimaklumkan melalui emel ini.
            </p>
          </td></tr>
        </table>

        <p style="margin:0 0 12px;color:#374151;font-size:14px;font-weight:600;">Langkah seterusnya:</p>
        <ol style="margin:0 0 28px;padding-left:20px;color:#374151;font-size:14px;line-height:1.8;">
          <li>Log masuk di <a href="{LOGIN_URL}" style="color:#1e3a8a;">{LOGIN_URL}</a></li>
          <li>Tukar kata laluan sementara kepada kata laluan pilihan anda.</li>
          <li>Lengkapkan maklumat profil anda.</li>
          <li>Semak status keputusan ujian di bahagian <strong>Permohonan</strong>.</li>
        </ol>

        <!-- CTA Button -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
          <tr><td align="center">
            <a href="{LOGIN_URL}" style="display:inline-block;padding:14px 36px;background:#1e3a8a;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:8px;">
              Log Masuk Sekarang
            </a>
          </td></tr>
        </table>

        <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
          Jika ada pertanyaan, hubungi admin di
          <a href="mailto:admin@refpahang.com" style="color:#1e3a8a;">admin@refpahang.com</a>
        </p>
      </td></tr>

      <!-- Footer -->
      <tr><td style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
        <p style="margin:0;font-size:12px;color:#9ca3af;">
          © 2026 Persatuan Bola Sepak Negeri Pahang. Semua hak terpelihara.
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>"""


def send_email(smtp, nama: str, emel: str, password: str) -> bool:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Akaun Sistem RefPahang — Peperiksaan Kelas III FAM 2026"
    msg["From"] = f"{FROM_NAME} <{SMTP_USER}>"
    msg["To"] = f"{nama.title()} <{emel}>"

    html = build_email(nama, emel, password)
    msg.attach(MIMEText(html, "html", "utf-8"))

    smtp.sendmail(SMTP_USER, emel, msg.as_bytes())
    return True


def main():
    print("=" * 60)
    print("  Blast Emel Kelas III FAM 2026")
    print(f"  Jumlah penerima: {len(PEMOHON)}")
    print("=" * 60)

    context = ssl.create_default_context()
    sent = 0
    failed = []

    with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=context) as smtp:
        smtp.login(SMTP_USER, SMTP_PASS)
        print(f"\n✓ Berjaya sambung ke {SMTP_HOST}\n")

        for i, (nama, emel, password) in enumerate(PEMOHON, 1):
            try:
                send_email(smtp, nama, emel, password)
                print(f"[{i:02d}/42] ✓ {emel}")
                sent += 1
                time.sleep(0.5)  # elak rate limit
            except Exception as e:
                print(f"[{i:02d}/42] ✗ {emel} — {e}")
                failed.append(emel)

    print("\n" + "=" * 60)
    print(f"  Selesai. Berjaya: {sent} | Gagal: {len(failed)}")
    if failed:
        print("  Gagal:")
        for f in failed:
            print(f"    - {f}")
    print("=" * 60)


if __name__ == "__main__":
    main()
