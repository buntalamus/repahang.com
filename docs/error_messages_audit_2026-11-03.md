# Semakan mesej ralat portal — 3 November 2026

Masalah asal: permohonan Penilai ditunjukkan sebagai `Menunggu`, lalu Admin menyangka ia menunggu keputusan Admin. Permohonan yang masih `Menunggu PP Daerah` menerima HTTP 404 dengan mesej gabungan “tidak dijumpai atau sudah diproses”. Beberapa halaman menutup mesej API dengan toast umum; sebahagian permintaan pula tiada pengendali ralat pada halaman.

## Perubahan

- Senarai permohonan komputer dan telefon serta ringkasan Admin mengekalkan tahap semakan `Menunggu PP Daerah` / `Menunggu Admin`. Penapis boleh memisahkan kedua-duanya; jumlah keseluruhan menunggu masih mengira kedua-dua tahap.
- Lulus/Tolak hanya dibenarkan pada status `Menunggu Admin`, termasuk halaman laporan. Status lain menerangkan sebab tindakan disekat.
- API keputusan Admin membezakan rekod tiada (404), status bercanggah (409), dan medan keputusan tidak sah (400). API pengesahan PP turut membezakan rekod di luar skop akaun daripada konflik status; larangan mengesahkan permohonan sendiri dikekalkan.
- Pengendali HTTP bersama melaporkan sebab daripada API, butiran medan/ralat yang dibekalkan, status semasa, tindakan seterusnya, serta ID rekod dan nombor rujukan jika ada. Respons HTTP 200 dengan `error: true` turut dilaporkan tanpa menukar kontrak respons.
- Toast ralat API kekal sehingga ditutup, mempunyai pemisah baris, boleh dibaca pada telefon, dan tidak berganda antara halaman dengan interceptor.
- Ralat rangkaian, timeout, JSON tidak sah, dan ralat muat turun dalam bentuk Blob menggunakan laluan yang sama. Bagi permintaan tulis yang keputusannya belum diketahui, arahan meminta pengguna menyemak rekod sebelum menghantar semula.
- Respons API mempunyai `X-Request-ID`. Kegagalan HTTP dan pengecualian pelayan direkod dengan nombor rujukan, kaedah dan laluan. Pengecualian dalaman tidak dipaparkan sebagai butiran pengguna; jika sebab belum diketahui, mesej menyatakannya dan memberi rujukan untuk Admin.
- Polling latar mengekalkan pengendalian ralat sementara tanpa membanjiri toast. Semakan keupayaan demo 404 di produksi adalah dijangka; dialog akaun tidak aktif semasa log masuk dikekalkan. Eksport master data mengekalkan had 90 saat.

## Skop dan bukti

Audit statik meliputi semua fail TypeScript frontend. Ujian mensimulasikan kegagalan untuk 67 endpoint yang dirujuk frontend dan mengaudit 151 callback ralat. Ini ialah ujian pengendalian kegagalan bersama, bukan bukti perjalanan penuh setiap operasi perniagaan.

Ujian integrasi komponen menggunakan komponen Admin, interceptor, RxJS dan ToastService sebenar. Ujian Worker menggunakan salinan SQLite tempatan; tiada keputusan permohonan produksi dibuat semasa QA.

Ujian pelayar menggunakan aset binaan produksi dengan API fixture tempatan. Pada lebar 1280 px dan 390 px, label PP dipaparkan tepat, butang disekat sebelum pengesahan PP, dan halaman yang sudah lapuk memaparkan satu toast lengkap apabila API mengembalikan status PP. Toast tidak melimpah keluar skrin, boleh ditutup, dan mencatat sifar pelanggaran axe dalam komponen toast. Bukti tempatan: `output/approval-errors-qa/`.

Pengesahan:

```text
npm --prefix cloudflare run test:frontend-errors
npm --prefix cloudflare run test:request-errors
npm --prefix cloudflare run test:admin-approve
npm --prefix cloudflare run test:pp-own-application
npm --prefix cloudflare run test:page-loading
npm --prefix cloudflare run typecheck
npm --prefix frontend run build:prod
REFPAHANG_AXE_PATH=/tmp/refpahang-axe.min.js node cloudflare/tests/frontend-errors-browser.mjs
npm --prefix cloudflare run build:mobile-web
git diff --check
```

Binaan Angular mempunyai amaran bajet bundle/CSS dan kebergantungan CommonJS `exceljs`; binaan tetap lulus. Binaan web Flutter mengekalkan konfigurasi sedia ada.

Sasaran pelepasan: Worker `refpahang`, `cloudflare/wrangler.production.jsonc`, domain `refpahang.com` dan `www.refpahang.com`. Versi sebelum pelepasan: `caee39d5-e0ed-47fc-b735-ee88cbf5c487`. Tiada migrasi D1 atau perubahan keputusan permohonan diperlukan.
