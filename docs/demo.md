# Sistem Demo — demo.refpahang.com

Salinan latihan RefPahang supaya sesiapa boleh mencuba semua fungsi tanpa menyentuh pangkalan data utama.

- **Kod:** sama dengan production.
- **Data:** D1 `refpahang_demo` dan R2 `refpahang-demo-media`. Semuanya **rekaan**: tiada nama, IC, telefon atau emel sebenar.
- **Reset:** tiada reset automatik. Data terkumpul daripada semua penguji. Rujuk "Bina semula" di bawah untuk mula semula.

## Akaun demo (kongsi)

| Peranan | Emel | Kata laluan |
|---|---|---|
| Admin | admin@demo.refpahang.com | DemoAdmin2026 |
| PP Daerah (Kuantan) | pp@demo.refpahang.com | DemoPP2026 |
| PP Daerah + Penilai (Temerloh) | pp-ra@demo.refpahang.com | DemoPPRA2026 |
| PP Daerah + Pengadil (Bentong) | pp-pengadil@demo.refpahang.com | DemoPPRef2026 |
| Pengadil (Kuantan) | pengadil@demo.refpahang.com | DemoPengadil2026 |
| Penilai | penilai@demo.refpahang.com | DemoPenilai2026 |

- **Sumber:** senarai ini datang dari `cloudflare/demo/accounts.json`. Halaman log masuk (web dan app) memaparkannya sebagai butang.
- **Perlindungan:** akaun kongsi tidak boleh ditukar kata laluan, emel atau status, tidak boleh dinyahaktif, dan tiada pautan lupa kata laluan. Ini supaya seorang penguji tidak mengunci penguji lain.

Penguji yang mahu menerima emel dan Telegram sebenar perlu daftar akaun sendiri di demo.refpahang.com/daftar. Admin demo kemudian meluluskannya.

## Apa yang dihantar keluar

`DEMO_MODE=1` (`cloudflare/src/demo.ts`). Semua suis (lantikan, laporan, pukal, peti emel, push) dihidupkan.

| Penerima | Emel | Telegram | Push |
|---|---|---|---|
| Orang rekaan (`@demo.invalid`, `@demo.refpahang.com`, chat id ≤ −8×10¹⁵) | Disimpan dalam **Peti Keluar Demo** (Admin → Peti Keluar Demo). Tidak dihantar. | Disimpan dalam Peti Keluar Demo | Tiada peranti |
| Penguji sebenar (akaun sendiri) | Dihantar, subjek bermula `[DEMO]` | Dihantar melalui bot utama `@refpahang_bot`, bermula `🧪 DEMO — sistem latihan` | Dihantar, tajuk `[DEMO]` |

Perkara lain yang berbeza daripada production:
- **Emel masuk:** tiada (tiada `addresses`).
- **IMAP:** dimatikan.
- **Auto-nyahaktif akaun:** dilangkau, kerana demo tidak direset.

### Telegram (bot dikongsi dengan production)

Bot hanya ada satu webhook, dan ia menghala ke production. Aliran untuk `/start <token>` dan butang Terima/Tolak:

1. Production memproses token yang wujud dalam D1 production seperti biasa.
2. Token yang **tiada** dalam production diteruskan ke `https://demo.refpahang.com/api/telegram-webhook.php` dengan header `X-Demo-Relay-Secret` (`relayedToDemo` dalam `src/telegram-webhook.ts`).
3. Demo membalas `404` jika ia juga tidak kenal token itu. Production kemudian membalas "pautan tidak aktif" seperti dahulu.

Keperluan konfigurasi:
- **Production:** var/secret `DEMO_RELAY_URL` dan secret `DEMO_RELAY_SECRET`.
- **Demo:** secret `DEMO_RELAY_SECRET` dengan nilai yang sama. Webhook demo menolak permintaan tanpa header rahsia itu (`403`).

## App mobile

App yang sama digunakan untuk demo. Di skrin log masuk ada pautan **Cuba Sistem Demo** (`mobile/lib/config.dart`):
- **Tukar mod:** pilihan disimpan dalam secure storage. App menghala ke demo.refpahang.com dan memaparkan reben **DEMO**.
- **Kembali:** butang "Keluar mod demo" kembali ke production.
- **Sesi:** menukar mod akan log keluar dahulu, jadi sesi dan push tidak bercampur antara dua server.
- **Web app:** web app di demo.refpahang.com/app mengenal pasti demo melalui nama host.

## Data seed

`cloudflare/demo/build_demo_seed.py` (deterministik) membina:
- **Orang:** 6 akaun kongsi, PP untuk setiap daerah, 72 pengadil, 8 penilai dan 7 pegawai luar (termasuk 2 Pengerusi Pengadil).
- **Pendaftaran:** pendaftaran 2025/2026 yang lulus.
- **Permohonan 2027:** ada yang menunggu PP, ada yang menunggu Admin, dan satu ditolak.
- **Rekod perlawanan:** rekod perlawanan peribadi, termasuk beberapa yang menunggu pengesahan PP.
- **Kejohanan:**
  - **Liga Demo:** mingguan di sekitar tarikh seed: selesai, menunggu laporan, menunggu pengerusi, menunggu jawapan, disahkan, belum lantik, dibatalkan.
  - **Karnival B15:** selesai.
  - **Piala Demo:** akan datang, belum lantik, dengan pool sedia.
- **Lain-lain:** pengumuman dan notifikasi.

Hanya **skema** dibaca daripada snapshot peribadi. Data yang disalin hanyalah jadual rujukan: `districts`, `persatuan_bolasepak_daerah` dan `application_settings`. Akaun bank dalam tetapan diganti dengan nilai demo.

Lantikan "Belum Jawab" yang di-seed akan ditolak automatik 48 jam selepas tarikh seed. Ini mengikut peraturan sebenar. Selepas itu, Admin demo boleh membuat lantikan baru.

## Bina semula (mula dari kosong)

Gunakan Node 22 (`nvm use 22.23.2`). Jalankan dari `cloudflare/`:

```sh
OUT=../output/cloudflare/demo/demo_$(date +%Y%m%d).sqlite
python3 demo/build_demo_seed.py --schema-from ../output/cloudflare/refpahang_2026-10-15_latest.sqlite --output $OUT
REFPAHANG_TEST_SNAPSHOT=$OUT node --no-warnings demo/smoke.mjs        # semakan sebelum import
python3 sqlite_to_d1_sql.py --snapshot $OUT --output ${OUT%.sqlite}.sql
# D1 baru, kemudian kemas kini database_id dalam wrangler.demo.jsonc:
npx wrangler d1 create refpahang_demo_<tarikh> --location apac
npx wrangler d1 execute <nama> --remote --file ${OUT%.sqlite}.sql --config wrangler.demo.jsonc
npx wrangler d1 migrations apply <nama> --remote --config wrangler.demo.jsonc
npm run deploy:demo
```

Jangan sesekali jalankan arahan ini dengan `--config wrangler.production.jsonc` atau `wrangler.jsonc`.

## Deploy biasa

Jalankan `npm run deploy:demo` dari `cloudflare/`. Ia menjalankan typecheck, membina frontend dan mobile-web, kemudian `wrangler deploy --config wrangler.demo.jsonc`.

Migration baru untuk demo:

```sh
npx wrangler d1 migrations apply refpahang_demo --remote --config wrangler.demo.jsonc
```
